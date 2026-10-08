# Overlay the route onto the exact Monica image already used in production.
FROM monica:promptu-base-v4.1.2

COPY --chown=www-data:www-data routes/web.php /var/www/html/routes/web.php
RUN rm -f /var/www/html/bootstrap/cache/routes-*.php
