#!/bin/bash
# PIECE Admin Dashboard — real-time server monitoring
# Usage: ./scripts/admin-dashboard.sh

SERVER="root@65.109.232.32"

clear 2>/dev/null
echo "╔═══════════════════════════════════════════════════════╗"
echo "║           PIECE — Admin Dashboard                    ║"
echo "║           $(date '+%Y-%m-%d %H:%M:%S')                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 $SERVER '
cd ~/piece

# Read MongoDB credentials from .env
MONGO_USER=$(grep MONGO_ROOT_USER .env | cut -d= -f2)
MONGO_PASS=$(grep MONGO_ROOT_PASSWORD .env | cut -d= -f2)

docker exec piece-mongodb-1 mongosh "mongodb://${MONGO_USER}:${MONGO_PASS}@localhost:27017" --quiet --eval "
const db = db.getSiblingDB(\"piece_system\");

const users = db.users.find({}, {email:1, name:1, createdAt:1}).sort({createdAt:-1}).toArray();
print(\"USERS (\" + users.length + \")\");
print(\"─────────────────────────────────────────────\");
users.forEach(u => {
  const d = new Date(u.createdAt);
  print(\"  \" + (u.email || \"-\") + \" | \" + (u.name || \"-\") + \" | \" + d.toISOString().slice(0,16));
});

const sessions = db.auth_sessions.find({revokedAt:null}).sort({lastActiveAt:-1}).toArray();
print(\"\");
print(\"ACTIVE SESSIONS (\" + sessions.length + \")\");
print(\"─────────────────────────────────────────────\");
sessions.forEach(s => {
  const d = new Date(s.lastActiveAt);
  const browser = (s.deviceInfo && s.deviceInfo.browser) || \"?\";
  const os = (s.deviceInfo && s.deviceInfo.os) || \"?\";
  print(\"  \" + browser + \" | \" + os + \" | \" + (s.ip || \"?\") + \" | \" + d.toISOString().slice(11,19));
});

const events = db.auth_audit_log.find().sort({createdAt:-1}).limit(20).toArray();
print(\"\");
print(\"RECENT EVENTS (last 20)\");
print(\"─────────────────────────────────────────────\");
events.forEach(e => {
  const d = new Date(e.createdAt);
  const ev = (e.event || \"-\").padEnd(18);
  print(\"  \" + d.toISOString().slice(11,19) + \" \" + ev + \" \" + (e.email || \"\") + \" \" + ((e.metadata && e.metadata.ip) || \"\"));
});
" 2>/dev/null

echo ""
echo "SERVICES"
echo "─────────────────────────────────────────────"
docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | while read line; do
  echo "  $line"
done
'
