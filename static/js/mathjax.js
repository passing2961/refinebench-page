window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
      // Define custom LaTeX environments to prevent "Unknown environment" errors
      // These environments will be ignored by MathJax (rendered as plain text)
      tags: 'ams',
      // Suppress error messages for unknown environments
      formatError: (jax, error) => {
        // Suppress "Unknown environment" errors
        if (error.message && error.message.includes('Unknown environment')) {
          return '';
        }
        return error.message;
      }
    },
    options: {
      // Skip HTML tags to prevent MathJax from processing HTML entities
      skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
      // Ignore LaTeX environments that MathJax doesn't recognize
      ignoreHtmlClass: 'tex2jax_ignore',
      processHtmlClass: 'tex2jax_process'
    },
    startup: {
      ready: () => {
        // Register custom environments to prevent errors
        if (MathJax.startup && MathJax.startup.defaultReady) {
          MathJax.startup.defaultReady();
        }
      }
    }
  };