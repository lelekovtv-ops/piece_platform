#!/bin/sh
set -e

STAGING_GATE_TOKEN="${STAGING_GATE_TOKEN:?Error: STAGING_GATE_TOKEN must be set in environment}"
export STAGING_GATE_TOKEN

envsubst '${STAGING_GATE_TOKEN}' < /etc/nginx/templates/staging-ssl.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
