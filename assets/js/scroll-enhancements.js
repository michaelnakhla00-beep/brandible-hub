// Scroll enhancements for single-page layouts
// This file provides smooth scroll, scroll to top, active section highlighting, and scroll progress

(function() {
  'use strict';
  
  // Initialize scroll enhancements
  function initScrollEnhancements() {
    // Add scroll progress indicator
    addScrollProgressIndicator();
    
    // Add scroll to top button
    addScrollToTopButton();
    
    // Add active section highlighting for navigation
    addActiveSectionHighlighting();
    
    // Update scroll progress on scroll
    updateScrollProgress();
  }
  
  // Add scroll progress indicator at top of page
  function addScrollProgressIndicator() {
    if (document.querySelector('.scroll-progress')) return; // Already exists
    
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    document.body.insertBefore(progressBar, document.body.firstChild);
  }
  
  // Add scroll to top button
  function addScrollToTopButton() {
    if (document.getElementById('scrollToTopBtn')) return; // Already exists
    
    const scrollBtn = document.createElement('button');
    scrollBtn.id = 'scrollToTopBtn';
    scrollBtn.className = 'scroll-to-top';
    scrollBtn.setAttribute('aria-label', 'Scroll to top');
    scrollBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    `;
    
    scrollBtn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    document.body.appendChild(scrollBtn);
    
    // Show/hide button based on scroll position
    let ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        window.requestAnimationFrame(function() {
          const scrollBtn = document.getElementById('scrollToTopBtn');
          if (scrollBtn) {
            if (window.pageYOffset > 300) {
              scrollBtn.classList.add('visible');
            } else {
              scrollBtn.classList.remove('visible');
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    });
  }
  
  // Add active section highlighting using Intersection Observer
  function addActiveSectionHighlighting() {
    const navLinks = document.querySelectorAll('nav a[href^="#"]');
    if (navLinks.length === 0) return;
    
    const sections = Array.from(navLinks).map(link => {
      const href = link.getAttribute('href');
      if (href && href !== '#') {
        return document.querySelector(href);
      }
      return null;
    }).filter(Boolean);
    
    if (sections.length === 0) return;
    
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    };
    
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          if (id) {
            // Remove active from all links
            navLinks.forEach(link => {
              link.classList.remove('sidebar-link-active');
            });
            
            // Add active to matching link
            const activeLink = document.querySelector(`nav a[href="#${id}"]`);
            if (activeLink) {
              activeLink.classList.add('sidebar-link-active');
            }
          }
        }
      });
    }, observerOptions);
    
    sections.forEach(section => {
      if (section) observer.observe(section);
    });
    
    // Also handle manual clicks on nav links with proper scroll positioning
    navLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href && href !== '#') {
          e.preventDefault(); // Prevent default anchor behavior
          
          const target = document.querySelector(href);
          if (target) {
            // Calculate header height dynamically
            const header = document.querySelector('header');
            const stickyNav = document.querySelector('nav');
            let offset = 0;
            
            if (header) {
              const headerRect = header.getBoundingClientRect();
              offset += headerRect.height;
            }
            
            if (stickyNav) {
              const navRect = stickyNav.getBoundingClientRect();
              // Only add nav height if it's sticky and visible
              const navStyle = window.getComputedStyle(stickyNav);
              if (navStyle.position === 'sticky' || navStyle.position === 'fixed') {
                offset += navRect.height;
              }
            }
            
            // Add extra padding for better visual spacing
            offset += 20;
            
            // Get target position
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
            
            // Scroll to position accounting for headers
            window.scrollTo({
              top: targetPosition - offset,
              behavior: 'smooth'
            });
            
            // Update active state after scroll
            setTimeout(() => {
              navLinks.forEach(l => l.classList.remove('sidebar-link-active'));
              this.classList.add('sidebar-link-active');
            }, 100);
          }
        }
      });
    });
  }
  
  // Update scroll progress indicator
  function updateScrollProgress() {
    let ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        window.requestAnimationFrame(function() {
          const progressBar = document.querySelector('.scroll-progress');
          if (progressBar) {
            const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (window.pageYOffset / windowHeight) * 100;
            progressBar.style.width = scrolled + '%';
          }
          ticking = false;
        });
        ticking = true;
      }
    });
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollEnhancements);
  } else {
    initScrollEnhancements();
  }
})();

