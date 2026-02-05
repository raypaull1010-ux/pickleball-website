// Netlify Serverless Function: Analyze Drill Video with Claude Vision
//
// This function:
// 1. Receives video URL and drill type from the frontend
// 2. Extracts frames from the video using Cloudinary
// 3. Sends frames to Claude Vision API for analysis
// 4. Returns structured feedback
//
// Environment variables needed (set in Netlify dashboard):
// - ANTHROPIC_API_KEY: Your Claude API key
// - CLOUDINARY_CLOUD_NAME: Your Cloudinary cloud name (optional, for Cloudinary URLs)

const Anthropic = require('@anthropic-ai/sdk');
const { withSecurity, isValidUrl } = require('./lib/security');

// Drill-specific prompts for better analysis
const DRILL_PROMPTS = {
  dinking: `Focus on analyzing these dinking technique elements:
- Paddle face angle at contact (should be slightly open)
- Contact point relative to body (should be out in front)
- Wrist stability vs excessive wrist action
- Knee bend and athletic stance
- Weight transfer and balance
- Recovery position after each shot
- Shot trajectory and margin over net`,

  'third-shot-drop': `Focus on analyzing these third shot drop elements:
- Backswing length (should be compact, not big)
- Contact point (should be out in front)
- Follow-through direction (lifting/pushing motion, not swinging)
- Knee involvement in the shot (using legs for power)
- Ball trajectory (should arc high, not drive flat)
- Landing zone consistency (aiming for transition zone)`,

  'speed-up': `Focus on analyzing these speed-up and counter elements:
- Timing of the attack (when to speed up)
- Paddle position and preparation
- Weight distribution during the shot
- Target selection and placement
- Recovery after the speed-up
- Counter-attack technique and readiness`,

  reset: `Focus on analyzing these reset technique elements:
- Soft hands and grip pressure
- Absorption technique (giving with the ball)
- Paddle face control and angle
- Body position and balance
- Shot trajectory (high and soft back to kitchen)
- Recovery to ready position`,

  volley: `Focus on analyzing these volley technique elements:
- Ready position between shots
- Punch vs swing motion (should be compact punch)
- Footwork and split step
- Contact point (out in front)
- Paddle stability through contact
- Recovery step after each volley`,

  serve: `Focus on analyzing these serve technique elements:
- Toss consistency and placement
- Contact point height and position
- Follow-through direction
- Depth and placement patterns
- Consistency of motion
- Power generation (if applicable)`,

  return: `Focus on analyzing these return technique elements:
- Ready position and anticipation
- Split step timing
- Contact point (early, out in front)
- Depth of returns
- Recovery to ready position
- Footwork patterns`,

  transition: `Focus on analyzing these transition zone elements:
- Footwork through the transition zone
- Shot selection while moving
- Balance and body control
- When to stop vs continue moving forward
- Reset ability from transition zone
- Split step timing at the kitchen`,

  other: `Focus on general pickleball technique elements:
- Body positioning and balance
- Paddle preparation and angle
- Contact point consistency
- Footwork patterns
- Shot trajectory and placement
- Recovery to ready position`
};

// Extract frames from video URL (works with various video hosting services)
function extractFrameUrls(videoUrl) {
  // Handle Cloudinary URLs - extract frames at different timestamps
  if (videoUrl.includes('cloudinary.com') || videoUrl.includes('res.cloudinary.com')) {
    // Cloudinary video frame extraction
    // Format: /video/upload/so_1,f_jpg/video_id.jpg (so_X = second offset)
    const frames = [];
    const timestamps = [1, 5, 15, 30]; // Extract at 1s, 5s, 15s, 30s

    for (const ts of timestamps) {
      // Transform video URL to extract frame at specific second
      const frameUrl = videoUrl
        .replace('/video/upload/', `/video/upload/so_${ts},f_jpg,w_800,h_600,c_limit/`)
        .replace(/\.[^.]+$/, '.jpg');
      frames.push(frameUrl);
    }
    return frames;
  }

  // Handle Google Drive URLs
  if (videoUrl.includes('drive.google.com')) {
    // Can't extract frames from Drive directly - user needs to use thumbnail or provide screenshots
    return null;
  }

  // Handle Dropbox URLs
  if (videoUrl.includes('dropbox.com')) {
    // Can't extract frames from Dropbox directly
    return null;
  }

  // Handle direct video URLs (mp4, mov, etc.)
  // These would need to be processed through a service like Cloudinary first
  if (videoUrl.match(/\.(mp4|mov|avi|webm)(\?|$)/i)) {
    return null;
  }

  // Handle image URLs (if user provides screenshots/frames directly)
  if (videoUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) {
    return [videoUrl];
  }

  return null;
}

// Main handler
const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { videoUrl, drillType, focusArea, useDemo } = JSON.parse(event.body);

    // Validate inputs
    if (!videoUrl || !drillType) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing required fields: videoUrl and drillType' })
      };
    }

    // Validate video URL format
    if (!isValidUrl(videoUrl)) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Invalid video URL format' })
      };
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not configured');
      // Fall back to demo mode if no API key
      const analysisResult = generateDemoResponse(drillType, focusArea);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          analysis: analysisResult,
          mode: 'demo',
          message: 'Running in demo mode. Configure ANTHROPIC_API_KEY for real analysis.'
        })
      };
    }

    // If demo mode explicitly requested
    if (useDemo) {
      const analysisResult = generateDemoResponse(drillType, focusArea);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          analysis: analysisResult,
          mode: 'demo'
        })
      };
    }

    // Get drill-specific prompt
    const drillPrompt = DRILL_PROMPTS[drillType] || DRILL_PROMPTS.other;

    // Try to extract frames from video
    const frameUrls = extractFrameUrls(videoUrl);

    // Build the analysis prompt
    const systemPrompt = `You are an expert pickleball coach with a 5.1 DUPR rating, specializing in video analysis and technique improvement. You have coached hundreds of players from beginners to advanced competitors.

Your role is to analyze drill videos/images and provide actionable, specific feedback that helps players improve immediately.

IMPORTANT GUIDELINES:
- Be encouraging but honest - players want real feedback, not just compliments
- Use pickleball-specific terminology that players understand
- Give specific, actionable fixes, not vague advice
- Reference what you see in the images when possible
- Keep feedback focused on 1-2 main issues (don't overwhelm)
- Recommend specific drills they can do to improve`;

    const userPrompt = `Analyze this pickleball drill video/image and provide detailed feedback.

DRILL TYPE: ${getDrillDisplayName(drillType)}

${drillPrompt}

${focusArea ? `USER'S SPECIFIC FOCUS AREA: ${focusArea}` : ''}

Please provide your analysis in the following JSON format:
{
  "grade": "B+",
  "gradeExplanation": "Brief explanation of the grade (1 sentence)",
  "strengths": [
    "Specific strength 1 observed",
    "Specific strength 2 observed",
    "Specific strength 3 observed"
  ],
  "primaryIssue": "The single most important thing to fix, described in detail with what you observed",
  "howToFix": "Specific, step-by-step instructions on how to fix the primary issue. Include body positioning cues, practice tips, and what correct technique should feel like.",
  "drillRecommendation": "A specific drill name and instructions (sets, reps, focus points) to address the primary issue"
}

GRADING SCALE:
- A/A+: Excellent technique, minor refinements only
- B/B+: Good technique, one clear area to improve
- C/C+: Developing technique, fundamentals need work
- D: Significant issues, needs focused practice
- F: Major technique problems, consider in-person coaching

Respond ONLY with the JSON object, no other text.`;

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Build message content
    let messageContent = [];

    if (frameUrls && frameUrls.length > 0) {
      // Add frame images to the message
      for (const frameUrl of frameUrls) {
        messageContent.push({
          type: 'image',
          source: {
            type: 'url',
            url: frameUrl
          }
        });
      }
    } else {
      // If we can't extract frames, try to use the URL directly as an image
      // or provide analysis based on the video link context
      messageContent.push({
        type: 'image',
        source: {
          type: 'url',
          url: videoUrl
        }
      });
    }

    // Add the text prompt
    messageContent.push({
      type: 'text',
      text: userPrompt
    });

    // Call Claude Vision API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: messageContent
        }
      ]
    });

    // Parse the response
    let analysisResult;
    try {
      const responseText = response.content[0].text;
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', parseError);
      // Return raw response if parsing fails
      analysisResult = {
        grade: 'N/A',
        gradeExplanation: 'Analysis completed but response format was unexpected.',
        strengths: ['Analysis was generated successfully'],
        primaryIssue: response.content[0].text,
        howToFix: 'Please review the full analysis above.',
        drillRecommendation: 'Contact coach for personalized drill recommendations.'
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        analysis: analysisResult,
        mode: 'live',
        framesAnalyzed: frameUrls ? frameUrls.length : 1
      })
    };

  } catch (error) {
    console.error('Analysis error:', error);

    // If Claude API fails, fall back to demo response
    if (error.message.includes('API') || error.message.includes('rate') || error.message.includes('image')) {
      try {
        const { drillType, focusArea } = JSON.parse(event.body);
        const analysisResult = generateDemoResponse(drillType || 'other', focusArea);
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            analysis: analysisResult,
            mode: 'demo',
            message: 'Using demo analysis due to video processing limitations. For best results, upload video to Cloudinary.'
          })
        };
      } catch (e) {
        // Ignore parse error
      }
    }

    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Analysis failed',
        message: error.message
      })
    };
  }
};

// Helper to get display name for drill type
function getDrillDisplayName(type) {
  const names = {
    'dinking': 'Dinking Drill',
    'third-shot-drop': 'Third Shot Drop Practice',
    'speed-up': 'Speed-up & Counter Drill',
    'reset': 'Reset Drill',
    'volley': 'Volley Practice',
    'serve': 'Serve Practice',
    'return': 'Return Practice',
    'transition': 'Transition Zone Work',
    'other': 'General Drill'
  };
  return names[type] || 'General Drill';
}

// Demo response generator (fallback when API unavailable)
function generateDemoResponse(drillType, focusArea) {
  const responses = {
    'dinking': {
      grade: 'B+',
      gradeExplanation: 'Solid dinking fundamentals with one key area for improvement.',
      strengths: [
        'Consistent paddle face angle on forehand dinks',
        'Good knee bend maintaining athletic stance throughout',
        'Smooth weight transfer on most shots'
      ],
      primaryIssue: 'Contact point is slightly behind your body on backhand dinks, causing the ball to pop up higher than intended. This gives your opponent more time and attack opportunities.',
      howToFix: 'Focus on getting your paddle out in front earlier on the backhand side. Your contact point should be 6-8 inches in front of your lead foot. Practice by placing a cone in front of you and making sure you contact the ball before it reaches the cone line. Also, rotate your shoulders earlier to create space for the paddle to get out front.',
      drillRecommendation: '"Early Contact Wall Drill" — Stand 6 feet from a wall, place a line of tape on the ground 12 inches in front of your feet. Practice backhand dinks, focusing on contacting the ball before it crosses the tape line. Do 3 sets of 30 reps, then film yourself again to check progress.'
    },
    'third-shot-drop': {
      grade: 'B',
      gradeExplanation: 'Good drop mechanics but trajectory needs adjustment.',
      strengths: [
        'Compact backswing without over-rotation',
        'Good use of legs to generate lift',
        'Consistent setup position before each shot'
      ],
      primaryIssue: 'Your drops are landing too deep in the court, around the transition zone instead of the kitchen. This is caused by too much forward momentum in your swing rather than an upward lifting motion.',
      howToFix: 'Think "lift and push" rather than "swing forward." Your paddle should move more upward than forward after contact. Imagine you\'re sliding the ball under a low ceiling. Also, try opening your paddle face slightly more at contact to add more arc to the shot.',
      drillRecommendation: '"Kitchen Target Drops" — Place a towel or target 2 feet inside the kitchen line. From the baseline, practice drops aiming for the target. Count how many out of 10 land in the kitchen. Goal: 7/10. Do 5 sets, rest 1 minute between sets.'
    },
    'speed-up': {
      grade: 'B-',
      gradeExplanation: 'Good aggression but timing and selection need refinement.',
      strengths: [
        'Quick paddle speed on attacks',
        'Good body rotation generating power',
        'Confident shot selection'
      ],
      primaryIssue: 'You\'re speeding up on balls that are below net height, which limits your angle options and gives opponents easier counter opportunities. Effective speed-ups should be on balls at or above net height.',
      howToFix: 'Be more patient and wait for the right ball. Before each speed-up, ask yourself: "Is this ball above the net?" If not, reset it and wait for a better opportunity. A good speed-up should go downward to your opponent\'s feet or hip, which is only possible from a higher contact point.',
      drillRecommendation: '"Red Light Green Light Dinking" — With a partner, dink crosscourt. Only speed up when you get a ball that bounces above your waist (green light). If it\'s below (red light), reset it. Track your success rate over 5-minute rounds.'
    },
    'reset': {
      grade: 'C+',
      gradeExplanation: 'Reset attempts show understanding but execution needs work.',
      strengths: [
        'Good recognition of when to reset',
        'Staying calm under pressure',
        'Maintaining ready position between shots'
      ],
      primaryIssue: 'Your grip is too tight during resets, causing the ball to pop up instead of absorbing pace. Resets require "soft hands" — a loose grip that allows the paddle to give with the ball.',
      howToFix: 'Loosen your grip to about 3-4 on a scale of 1-10 (10 being tightest). When the ball contacts your paddle, let your wrist and paddle "give" backward slightly, like catching an egg. The ball should drop softly over the net, not bounce off your paddle.',
      drillRecommendation: '"Soft Hands Wall Drill" — Stand 8 feet from a wall. Have someone throw or hit balls hard at you. Practice absorbing pace and dropping the ball to land within 3 feet of the wall. Focus on loose grip and giving with impact. Do 3 sets of 20.'
    },
    'volley': {
      grade: 'B+',
      gradeExplanation: 'Strong volley fundamentals with minor footwork improvement needed.',
      strengths: [
        'Good compact punch motion (not swinging)',
        'Paddle stays out in front of body',
        'Quick reactions to incoming balls'
      ],
      primaryIssue: 'Your split step timing is slightly late, causing you to be flat-footed on some volleys. This limits your ability to move laterally and reach wider balls.',
      howToFix: 'Focus on landing your split step exactly as your opponent contacts the ball, not after. This timing gives you the best chance to react in any direction. Practice by saying "hop" out loud when you see your opponent\'s paddle about to hit the ball.',
      drillRecommendation: '"Split Step Timing Drill" — Have a partner feed random volleys. Before each shot, focus only on your split step timing. Land the split step as they contact, then react. Do 50 reps, then switch. Quality of split step matters more than quality of volley for this drill.'
    },
    'serve': {
      grade: 'B',
      gradeExplanation: 'Reliable serve with opportunity for more depth and consistency.',
      strengths: [
        'Consistent toss placement',
        'Good contact point at waist height',
        'Smooth follow-through motion'
      ],
      primaryIssue: 'Your serves are landing mid-court rather than deep. Deep serves (within 2 feet of the baseline) force weaker returns and give you more time to approach.',
      howToFix: 'Aim for a target 2 feet inside the baseline, not the service box middle. Add a bit more follow-through toward your target. Think "push through the ball" rather than just making contact. Your paddle should finish pointing at your target.',
      drillRecommendation: '"Deep Serve Target Practice" — Place a towel 2 feet inside the baseline on the serve side. Practice 50 serves, counting how many land between the towel and baseline. Goal: 35/50. Focus on follow-through toward the target.'
    },
    'return': {
      grade: 'B',
      gradeExplanation: 'Solid returns with room for improved depth and positioning.',
      strengths: [
        'Good ready position while waiting',
        'Clean contact on most returns',
        'Consistent return placement'
      ],
      primaryIssue: 'Your returns are landing in the middle third of the court instead of deep. This allows the serving team an easier third shot. Deep returns put more pressure on opponents.',
      howToFix: 'After contact, continue your swing motion toward your target. Think about "pushing through" the ball rather than just blocking it back. Also, hit returns with a slight upward trajectory to clear the net with margin and still land deep.',
      drillRecommendation: '"Deep Return Challenge" — Have a partner serve to you. Your goal is to land returns within 3 feet of the baseline. Track your percentage over 20 serves. Goal: 14/20 deep. Repeat 3 rounds with 1-minute rest between.'
    },
    'transition': {
      grade: 'B-',
      gradeExplanation: 'Good awareness but footwork through the zone needs refinement.',
      strengths: [
        'Recognition of when to move forward',
        'Staying low through the transition',
        'Good shot selection while moving'
      ],
      primaryIssue: 'You\'re taking too big of steps through the transition zone, which puts you off-balance when you need to hit. Smaller, quicker steps keep you ready for any shot.',
      howToFix: 'Use small shuffle steps through the transition zone, never crossing your feet. Stop and split step after each shot before continuing forward. Think "hit and move" not "move and hit" — only advance after you\'ve successfully hit a shot.',
      drillRecommendation: '"Stop and Go Transition" — From the baseline, practice moving to the kitchen in stages: hit a drop, split step, small shuffle forward, split step, repeat. Only advance after a successful shot. Do 3 sets of 10 full transitions.'
    },
    'other': {
      grade: 'B',
      gradeExplanation: 'Good general technique with specific areas identified for improvement.',
      strengths: [
        'Solid ready position and athletic stance',
        'Good paddle preparation before shots',
        'Consistent contact point on most shots'
      ],
      primaryIssue: 'Your recovery to ready position after shots is slightly slow, which can leave you vulnerable to quick counter-attacks. Faster recovery creates more time to prepare for the next shot.',
      howToFix: 'Immediately after contact, bring your paddle back to the ready position (in front of your body, paddle up). Practice making this automatic by saying "ready" after each shot. Your feet should also reset to a balanced, athletic stance.',
      drillRecommendation: '"Quick Recovery Drill" — Rally with a partner, focusing only on how fast you return to ready position after each shot. Have your partner call out "ready!" if they see your paddle drop or if you\'re not in athletic stance. Goal: zero callouts in 3-minute rally.'
    }
  };

  // Add focus area consideration to response if provided
  let response = responses[drillType] || responses['other'];

  if (focusArea) {
    response = {
      ...response,
      primaryIssue: `Based on your focus area ("${focusArea}"): ${response.primaryIssue}`
    };
  }

  return response;
}

// Export with security middleware (rate limiting + input sanitization)
// Using lower rate limit since this is an expensive API call
exports.handler = withSecurity(handler, {
  endpoint: 'analyze-video',
  rateLimit: true,
  sanitize: true
});
