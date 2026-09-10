ScoutAI Public Pages & Content System

The ScoutAI public pages and content system was developed using React, CSS variables, Ant Design icons, and i18next as the core frontend stack to present a modern, professional, and accessible user experience for visitors, scouts, and recruitment teams.

The completed features include:
- Clean, responsive paper-style container design for the About Us page
- Responsive fluid typography scaling using CSS clamp() functions
- Comprehensive project background, accomplishments, credits, and legal disclaimers
- Bottom conversion CTA bands to prevent visitor dead-ends
- Symmetrical 3-card pricing layout for Free, Pro, and Team plans
- Visual emphasis and gradient highlights for the featured Pro plan
- Center-aligned monthly and annual billing toggle switch with 25% discount badge
- Interactive comparison table with row hover highlights
- Expandable FAQ accordion with smooth toggle transitions
- Sticky top document navigation bar for legal and policy documents
- Complete trailing period (.) cleanup across all UI titles, headings, badges, and buttons
- Dual-language support (English and Thai) via i18next dictionaries
- Production-ready Docker Compose containerization for all microservices
- Clean repository version control configuration with updated .gitignore rules

The About Us page is configured using a paper-style article container (max-width 840px) with fluid typography scaling. It presents the project story as a Decision Support System (DSS) combining AI, Machine Learning, and football scouting. It breaks down the system mission into structured sections: Lead summary, Body narrative, Accomplishments bullet list, Credits acknowledgment, and 3-part legal Disclaimer. A bottom conversion CTA band guides readers directly to the workspace or pricing plans upon completion.

The Pricing page features a balanced 3-card grid (Free, Pro, Team) designed with equal visual height and flex alignment. The middle Pro card is visually highlighted with a green accent border, mint background tint, "MOST POPULAR" badge, and solid dark green CTA button. Non-featured cards (Free and Team) share identical solid white backgrounds and drop shadows to ensure symmetric visual reflectance. Above the cards, a center-aligned billing toggle switch allows users to switch between Monthly and Annual pricing with an inline discount badge. Below the cards, an interactive comparison table features row hover highlights for effortless scanning, followed by an expandable FAQ accordion.

The Policy pages (Terms of Use, Privacy Policy, Policies) utilize the same 840px article container layout for design consistency. A sticky top pill navigation bar allows users to switch seamlessly between legal documents while scrolling through long content blocks without returning to the top of the page.

Public pages and routes include:
/
/about
/pricing
/policy
/terms
/privacy

Protected application routes include:
/app
/app/search
/app/results

Across all public pages, the UI copywriting follows a strict rule: trailing periods (.) are removed from all hero titles, section headings, kickers, badges, taglines, CTA buttons, and card descriptions, while sentence-ending periods are reserved strictly for full multi-sentence body paragraphs.

For deployment and environment management, the public pages and frontend application are packaged alongside the Node.js backend and Python ML engine using Docker Compose:
- ml-api: Python 3.12-slim FastAPI + ML Engine (Port 8000)
- backend: Node 22 Alpine Express API Server (Port 5000)
- frontend: Node 22 Alpine Vite React Web Application (Port 5173)

The repository version control is clean, with .gitignore rules excluding node_modules, dist, .env, .agents, command.txt, and build logs.

The overall public page navigation flow is:
User opens the application
  -> The system renders the public landing/about/pricing page
  -> The user switches language (EN/TH) or toggles billing (Monthly/Annual)
  -> The user explores features, compare tables, and FAQ items
  -> The user clicks a Call-to-Action (CTA) button
  -> Unauthenticated users are directed to /login
  -> Authenticated users proceed directly into the protected workspace (/app)

Overall, the public pages system now supports a complete brand story, transparent pricing, interactive policy navigation, responsive fluid typography, strict UI copywriting standards, and containerized production deployment.
