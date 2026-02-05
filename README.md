# Ray's Pickleball Coaching Website

This is your personal coaching website! Below are instructions for viewing, editing, and customizing it.

---

## Quick Start

### 1. View Your Website
Open Terminal and run:
```bash
cd /Users/raypaull/Documents/dev-work/ray-website
live-server
```
Your browser will open automatically at http://127.0.0.1:8080

### 2. Stop the Server
Press `Ctrl + C` in Terminal to stop the server.

---

## File Structure

```
ray-website/
├── index.html          ← Home page
├── about.html          ← About you
├── services.html       ← What you offer
├── pricing.html        ← Your rates
├── testimonials.html   ← Student reviews
├── contact.html        ← Contact form & info
├── css/
│   └── styles.css      ← All styling
├── images/             ← Your photos go here
└── README.md           ← This file
```

---

## How to Customize

### Adding Your Information
1. Open any `.html` file in a text editor (like TextEdit or VS Code)
2. Look for comments like `<!-- CUSTOMIZE: -->` for hints
3. Replace placeholder text with your own
4. Save the file - browser updates automatically!

### Things to Update:
- **about.html**: Your bio, photo, credentials
- **pricing.html**: Your actual rates (replace $XX)
- **testimonials.html**: Real reviews from students
- **contact.html**: Your email, phone, location, hours

### Adding Your Photo
1. Put your photo in the `images/` folder
2. In `about.html`, replace the placeholder with:
```html
<img src="images/your-photo.jpg" alt="Ray - Pickleball Coach">
```

### Changing Colors
Open `css/styles.css` and find the `:root` section at the top:
```css
:root {
    --primary-color: #2563eb;  /* Change this for main color */
}
```

---

## Helpful Tips

### Text Editor Recommendations
- **VS Code** (free): Download from https://code.visualstudio.com
- **Sublime Text**: Download from https://sublimetext.com

### Making the Contact Form Work
The contact form doesn't send emails yet. To make it work when you go live:
1. Sign up for [Formspree](https://formspree.io) (free tier available)
2. Replace `action="#"` with your Formspree URL

---

## Going Live (Publishing)

When you're ready to put your site on the internet:
1. **Netlify** (free): https://netlify.com - drag and drop your folder
2. **GitHub Pages** (free): If you know git
3. **Squarespace/Wix**: If you want a different platform later

---

## Getting Help

If you need help with your website, you can:
- Ask Claude Code for assistance
- Search for "HTML CSS tutorial" online
- Check out https://developer.mozilla.org for reference

Happy coaching! 🏓
