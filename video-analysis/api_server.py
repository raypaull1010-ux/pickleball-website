"""
🎬 VIDEO ANALYSIS API SERVER
Ray's Pickleball Platform

FastAPI server for processing video uploads and returning analysis results.
Designed to run on a separate server/container with GPU support.

Run with: uvicorn api_server:app --host 0.0.0.0 --port 8000

Endpoints:
    POST /analyze - Upload video for analysis
    GET /status/{job_id} - Check analysis status
    GET /results/{job_id} - Get analysis results
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
import os
import json
import asyncio
from datetime import datetime
import aiofiles

from analyzer import PickleballAnalyzer, analyze_video_file

app = FastAPI(
    title="Pickleball Video Analysis API",
    description="AI-powered video analysis for player stat extraction",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage paths
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/video-uploads")
RESULTS_DIR = os.environ.get("RESULTS_DIR", "/tmp/video-results")

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

# In-memory job tracking (use Redis in production)
jobs: Dict[str, Dict[str, Any]] = {}


class JobStatus(BaseModel):
    job_id: str
    status: str  # pending, processing, completed, failed
    progress: float
    created_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None


class AnalysisResult(BaseModel):
    job_id: str
    status: str
    video_duration: Optional[float] = None
    shot_breakdown: Optional[Dict[str, int]] = None
    avatar_stats: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = None
    full_results: Optional[Dict[str, Any]] = None


class WebhookConfig(BaseModel):
    url: str
    avatar_id: str


@app.get("/")
async def root():
    return {
        "service": "Pickleball Video Analysis API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "POST /analyze": "Upload video for analysis",
            "GET /status/{job_id}": "Check job status",
            "GET /results/{job_id}": "Get analysis results"
        }
    }


@app.post("/analyze")
async def analyze_video(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    avatar_id: Optional[str] = None,
    webhook_url: Optional[str] = None
):
    """
    Upload a video for analysis.

    - **video**: Video file (MP4, MOV, AVI)
    - **avatar_id**: Optional avatar ID to auto-update stats
    - **webhook_url**: Optional URL to call when analysis completes

    Returns job_id for tracking progress.
    """
    # Validate file type
    allowed_types = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"]
    if video.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )

    # Generate job ID
    job_id = str(uuid.uuid4())

    # Save uploaded file
    file_path = os.path.join(UPLOAD_DIR, f"{job_id}_{video.filename}")

    async with aiofiles.open(file_path, 'wb') as f:
        content = await video.read()
        await f.write(content)

    # Create job record
    jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "progress": 0.0,
        "created_at": datetime.utcnow().isoformat(),
        "file_path": file_path,
        "avatar_id": avatar_id,
        "webhook_url": webhook_url,
        "completed_at": None,
        "error": None,
        "results": None
    }

    # Start background processing
    background_tasks.add_task(process_video, job_id)

    return {
        "job_id": job_id,
        "status": "pending",
        "message": "Video uploaded successfully. Processing started.",
        "status_url": f"/status/{job_id}",
        "results_url": f"/results/{job_id}"
    }


async def process_video(job_id: str):
    """Background task to process video"""
    job = jobs.get(job_id)
    if not job:
        return

    try:
        # Update status
        job["status"] = "processing"
        job["progress"] = 0.1

        # Create analyzer
        analyzer = PickleballAnalyzer()

        def update_progress(p: float):
            job["progress"] = 0.1 + (p * 0.8)  # 10-90%

        # Run analysis
        results = analyzer.analyze_video(
            job["file_path"],
            progress_callback=update_progress
        )

        # Convert to dict
        results_dict = results.to_dict()

        # Save results
        results_path = os.path.join(RESULTS_DIR, f"{job_id}.json")
        async with aiofiles.open(results_path, 'w') as f:
            await f.write(json.dumps(results_dict, indent=2))

        # Update job
        job["status"] = "completed"
        job["progress"] = 1.0
        job["completed_at"] = datetime.utcnow().isoformat()
        job["results"] = results_dict

        # Call webhook if configured
        if job.get("webhook_url"):
            await call_webhook(job["webhook_url"], job_id, results_dict)

        # Clean up video file (optional)
        # os.remove(job["file_path"])

    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)
        job["completed_at"] = datetime.utcnow().isoformat()


async def call_webhook(url: str, job_id: str, results: dict):
    """Call webhook URL with results"""
    import aiohttp

    try:
        async with aiohttp.ClientSession() as session:
            await session.post(url, json={
                "job_id": job_id,
                "status": "completed",
                "avatar_stats": results.get("avatar_stats"),
                "shot_breakdown": results.get("shot_breakdown"),
                "confidence": results.get("overall_confidence")
            })
    except Exception as e:
        print(f"Webhook call failed: {e}")


@app.get("/status/{job_id}", response_model=JobStatus)
async def get_status(job_id: str):
    """Get the status of an analysis job"""
    job = jobs.get(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatus(
        job_id=job["job_id"],
        status=job["status"],
        progress=job["progress"],
        created_at=job["created_at"],
        completed_at=job.get("completed_at"),
        error=job.get("error")
    )


@app.get("/results/{job_id}", response_model=AnalysisResult)
async def get_results(job_id: str):
    """Get the results of a completed analysis job"""
    job = jobs.get(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] == "pending":
        raise HTTPException(status_code=202, detail="Analysis not yet started")

    if job["status"] == "processing":
        raise HTTPException(
            status_code=202,
            detail=f"Analysis in progress: {job['progress']*100:.1f}%"
        )

    if job["status"] == "failed":
        raise HTTPException(status_code=500, detail=job.get("error", "Analysis failed"))

    results = job.get("results", {})

    return AnalysisResult(
        job_id=job_id,
        status=job["status"],
        video_duration=results.get("video_duration"),
        shot_breakdown=results.get("shot_breakdown"),
        avatar_stats=results.get("avatar_stats"),
        confidence=results.get("overall_confidence"),
        full_results=results
    )


@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its associated files"""
    job = jobs.get(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Delete files
    try:
        if os.path.exists(job.get("file_path", "")):
            os.remove(job["file_path"])

        results_path = os.path.join(RESULTS_DIR, f"{job_id}.json")
        if os.path.exists(results_path):
            os.remove(results_path)
    except Exception as e:
        pass  # Ignore file deletion errors

    # Remove from memory
    del jobs[job_id]

    return {"message": "Job deleted successfully"}


@app.get("/health")
async def health_check():
    """Health check endpoint for load balancers"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "active_jobs": len([j for j in jobs.values() if j["status"] == "processing"])
    }


# Run with: uvicorn api_server:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
