import re

with open('landing-page/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# CSS Enhancements to insert before </style>
css_additions = """
    /* Ultra-Heavy 3D Perspective & Motion Engine Extensions */
    .section-container {
      perspective: 1200px;
      perspective-origin: 50% 50%;
      transform-style: preserve-3d;
      position: relative;
      will-change: perspective-origin;
    }

    .vault-card, .content-box, .spec-card, .faq-item, .grid-33, .grid-50, .cta-box {
      transform-style: preserve-3d;
      will-change: transform, opacity, filter;
      transition: box-shadow 0.4s ease, border-color 0.4s ease;
    }

    .vault-card:hover, .content-box:hover, .spec-card:hover {
      box-shadow: 0 25px 50px rgba(0,0,0,0.9), 0 0 30px var(--brass-glow);
      border-color: var(--brass);
    }

    .word, .char {
      display: inline-block;
      transform-style: preserve-3d;
      will-change: transform, opacity;
    }

    /* Floating Particles Background */
    #ambient-particles-canvas {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      opacity: 0.6;
    }

    /* Accessibility reduced motion */
    @media (prefers-reduced-motion: reduce) {
      *, ::before, ::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
      .section-container {
        perspective: none !important;
        transform-style: flat !important;
      }
      .vault-card, .content-box, .spec-card, .word, .char {
        transform: none !important;
        opacity: 1 !important;
      }
    }
"""

if "/* Ultra-Heavy 3D Perspective & Motion Engine Extensions */" not in html:
    html = html.replace('</style>', css_additions + '\n  </style>')

# Ensure canvas element is present right after body start
canvas_tag = '<canvas id="ambient-particles-canvas"></canvas>'
if canvas_tag not in html:
    html = html.replace('<body>', '<body>\n  ' + canvas_tag)

with open('landing-page/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated CSS and HTML structure successfully.")
