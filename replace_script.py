with open('landing-page/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

marker = "    /* ===== Lenis Smooth Scroll ===== */"
start_idx = html.find(marker)
end_idx = html.find("</body>")

new_script = """    /* ===== Lenis Smooth Scroll ===== */
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    /* ===== Scroll Progress Bar ===== */
    window.addEventListener('scroll', () => {
      const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      const progEl = document.getElementById('scroll-progress');
      if (progEl) progEl.style.width = scrolled + '%';
    });

    /* ===== Mouse Spotlight & Custom Cursor ===== */
    const spotlight = document.getElementById('spotlight');
    const cursorDot = document.getElementById('cursor-dot');

    window.addEventListener('mousemove', (e) => {
      if (spotlight) {
        spotlight.style.left = e.clientX + 'px';
        spotlight.style.top = e.clientY + 'px';
      }
      if (cursorDot) {
        cursorDot.style.left = e.clientX + 'px';
        cursorDot.style.top = e.clientY + 'px';
      }
    });

    /* ===== Continuous Ambient Gold Particles Canvas ===== */
    const particleCanvas = document.getElementById('ambient-particles-canvas');
    if (particleCanvas) {
      const ctx = particleCanvas.getContext('2d');
      let particles = [];

      function resizeCanvas() {
        particleCanvas.width = window.innerWidth;
        particleCanvas.height = window.innerHeight;
      }
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      for (let i = 0; i < 45; i++) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          radius: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.5 + 0.2,
          speedX: (Math.random() - 0.5) * 0.4,
          speedY: (Math.random() - 0.5) * 0.4
        });
      }

      function drawParticles() {
        ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        particles.forEach(p => {
          p.x += p.speedX;
          p.y += p.speedY;

          if (p.x < 0) p.x = particleCanvas.width;
          if (p.x > particleCanvas.width) p.x = 0;
          if (p.y < 0) p.y = particleCanvas.height;
          if (p.y > particleCanvas.height) p.y = 0;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(201, 162, 74, ${p.alpha})`;
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(201, 162, 74, 0.4)';
          ctx.fill();
        });
        requestAnimationFrame(drawParticles);
      }
      drawParticles();
    }

    /* ===== Text Splitting Helpers ===== */
    function splitToChars(element) {
      if (!element || element.dataset.splitDone) return element.querySelectorAll('.char');
      element.dataset.splitDone = "true";
      const text = element.textContent.trim();
      element.innerHTML = '';
      const chars = [];
      text.split('').forEach(char => {
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = char === ' ' ? '\\u00A0' : char;
        element.appendChild(span);
        chars.push(span);
      });
      return chars;
    }

    function splitToWords(element) {
      if (!element || element.dataset.splitDone) return element.querySelectorAll('.word');
      element.dataset.splitDone = "true";
      const text = element.textContent.trim();
      element.innerHTML = '';
      const words = [];
      const wordList = text.split(' ');
      wordList.forEach((word, idx) => {
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = word + (idx < wordList.length - 1 ? '\\u00A0' : '');
        element.appendChild(span);
        words.push(span);
      });
      return words;
    }

    /* ===== Check for Reduced Motion ===== */
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) {
      /* ===== 1. HERO PINNED SECTION WITH 3D SCRUBBED ROTATION ===== */
      const heroHeadline = document.querySelector('.hero h1');
      if (heroHeadline) {
        const chars = splitToChars(heroHeadline);
        gsap.set(chars, { opacity: 0, rotationX: -90, z: -100, y: 50 });
      }

      const heroSubtitle = document.querySelector('.hero p');
      if (heroSubtitle) {
        gsap.set(heroSubtitle, { opacity: 0, y: 30, z: -50 });
      }

      const heroDownloadGroup = document.querySelector('.download-group');
      if (heroDownloadGroup) {
        gsap.set(heroDownloadGroup, { opacity: 0, y: 40, z: 20 });
      }

      const heroTl = gsap.timeline({
        scrollTrigger: {
          trigger: '#hero-pin-section',
          start: 'top top',
          end: '+=150%',
          pin: true,
          scrub: 1,
          anticipatePin: 1
        }
      });

      heroTl
        .to('.ore-3d-wrap', {
          rotationY: 360,
          rotationX: 180,
          rotationZ: 45,
          scale: 1.25,
          z: 150,
          ease: 'none'
        }, 0)
        .to('.hero h1 .char', {
          opacity: 1,
          rotationX: 0,
          z: 0,
          y: 0,
          stagger: 0.03,
          ease: 'power2.out'
        }, 0.1)
        .to(heroSubtitle, {
          opacity: 1,
          y: 0,
          z: 0,
          ease: 'power2.out'
        }, 0.4)
        .to(heroDownloadGroup, {
          opacity: 1,
          y: 0,
          z: 0,
          ease: 'power2.out'
        }, 0.6)
        .to('.hero-content', {
          z: -300,
          rotationX: 15,
          opacity: 0.2,
          ease: 'power1.in'
        }, 0.85);

      /* ===== 2. VIRTUAL CAMERA MOVEMENT & 3D TRAVEL FOR ALL SECTIONS ===== */
      const sections = [
        { id: '#vault-section', cameraFrom: '20% 80%', cameraTo: '80% 20%', rotX: -12, rotY: 15, z: -180 },
        { id: '#crypto-section', cameraFrom: '80% 20%', cameraTo: '50% 50%', rotX: 15, rotY: -15, z: -220 },
        { id: '#onboarding-section', cameraFrom: '50% 10%', cameraTo: '50% 90%', rotX: -15, rotY: 10, z: -150 },
        { id: '#install-section', cameraFrom: '90% 50%', cameraTo: '10% 50%', rotX: 12, rotY: -12, z: -190 },
        { id: '#specs-section', cameraFrom: '10% 90%', cameraTo: '50% 50%', rotX: -10, rotY: 10, z: -200 },
        { id: '#kernel-section', cameraFrom: '50% 50%', cameraTo: '50% 100%', rotX: 18, rotY: -18, z: -250 },
        { id: '#about', cameraFrom: '30% 70%', cameraTo: '70% 30%', rotX: -12, rotY: 12, z: -160 },
        { id: '#faq-section', cameraFrom: '50% 0%', cameraTo: '50% 50%', rotX: 10, rotY: -10, z: -180 }
      ];

      sections.forEach(sec => {
        const el = document.querySelector(sec.id);
        if (!el) return;

        // Camera perspective origin morphing
        gsap.fromTo(el,
          { perspectiveOrigin: sec.cameraFrom },
          {
            perspectiveOrigin: sec.cameraTo,
            ease: 'none',
            scrollTrigger: {
              trigger: el,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1
            }
          }
        );

        // Section Title Character 3D choreography
        const titles = el.querySelectorAll('[data-reveal-title], .section-title, h2');
        titles.forEach(title => {
          const words = splitToWords(title);
          gsap.fromTo(words,
            { opacity: 0, rotationX: -80, rotationY: 25, z: sec.z, y: 80 },
            {
              opacity: 1,
              rotationX: 0,
              rotationY: 0,
              z: 0,
              y: 0,
              stagger: 0.05,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: title,
                start: 'top 88%',
                end: 'top 40%',
                scrub: 0.5
              }
            }
          );
        });

        // Cards and Content Boxes 3D Physical Travel
        const cards = el.querySelectorAll('.vault-card, .content-box, .spec-card, .faq-item, .grid-33, .grid-50, .cta-box');
        cards.forEach((card, idx) => {
          const direction = idx % 2 === 0 ? 1 : -1;
          gsap.fromTo(card,
            {
              opacity: 0,
              y: 180,
              x: direction * 80,
              rotationX: sec.rotX * direction,
              rotationY: sec.rotY * direction,
              rotationZ: direction * 6,
              scale: 0.85,
              z: sec.z
            },
            {
              opacity: 1,
              y: 0,
              x: 0,
              rotationX: 0,
              rotationY: 0,
              rotationZ: 0,
              scale: 1,
              z: 0,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 92%',
                end: 'top 55%',
                scrub: 0.8
              }
            }
          );
        });
      });

      /* ===== 3. HOVER-TRIGGERED 3D TILT ON CARDS AND BUTTONS ===== */
      const tiltElements = document.querySelectorAll('.vault-card, .content-box, .spec-card, .cta-box, .cta-btn, .cta-btn-secondary');
      tiltElements.forEach(el => {
        el.addEventListener('mousemove', (e) => {
          const rect = el.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rotateX = ((y - centerY) / centerY) * -12;
          const rotateY = ((x - centerX) / centerX) * 12;

          gsap.to(el, {
            rotationX: rotateX,
            rotationY: rotateY,
            z: 30,
            duration: 0.3,
            ease: 'power2.out'
          });
        });

        el.addEventListener('mouseleave', () => {
          gsap.to(el, {
            rotationX: 0,
            rotationY: 0,
            z: 0,
            duration: 0.6,
            ease: 'power2.out'
          });
        });
      });
    } else {
      // Reduced motion fallback
      document.querySelectorAll('.hero h1, [data-reveal-title], .section-title, h2, .vault-card, .content-box, .spec-card').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    }

    /* ===== Vault Card Radial Mouse Tracker ===== */
    document.querySelectorAll('.vault-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mx', x + '%');
        card.style.setProperty('--my', y + '%');
      });
    });

    /* ===== Refresh ScrollTrigger after load ===== */
    window.addEventListener('load', () => {
      ScrollTrigger.refresh();
    });
  </script>
</body>
</html>"""

html = html[:start_idx] + new_script

with open('landing-page/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated landing-page/index.html script successfully!")
