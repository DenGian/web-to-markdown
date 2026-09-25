# Security

Please report vulnerabilities through this repository's private vulnerability reporting. Include a reproducible case and affected version; avoid posting exploit details in a public issue before a fix is available.

The app is designed for local use. It validates submitted public URLs, redirects, and browser requests, but page content remains untrusted. Preview sanitizes rendered Markdown. Run the server on a trusted machine and keep dependencies updated. Public hosting requires additional network and process isolation beyond this local release.
