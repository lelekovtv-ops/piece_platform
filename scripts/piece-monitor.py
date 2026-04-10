#!/usr/bin/env python3
"""PIECE Monitor — Mac menu bar app."""

import subprocess
import json
import time
import rumps

SERVER = "root@65.109.232.32"
CACHE = {'users':[], 'sessions':[], 'events':[], 'services':[], 'ts':'never'}

def ssh(cmd):
    try:
        r = subprocess.run(
            ["ssh","-o","StrictHostKeyChecking=no","-o","ConnectTimeout=5", SERVER, cmd],
            capture_output=True, text=True, timeout=12
        )
        return r.stdout.strip()
    except:
        return ""

def fetch():
    global CACHE
    try:
        env = "cd ~/piece && MU=$(grep MONGO_ROOT_USER .env|cut -d= -f2) && MP=$(grep MONGO_ROOT_PASSWORD .env|cut -d= -f2)"
        mongo = 'docker exec piece-mongodb-1 mongosh "mongodb://${MU}:${MP}@localhost:27017" --quiet --eval'

        raw = ssh(f"""{env} && {mongo} 'const d=db.getSiblingDB("piece_system");JSON.stringify({{u:d.users.find({{}},{{email:1,name:1}}).sort({{createdAt:-1}}).limit(15).toArray(),s:d.auth_sessions.find({{revokedAt:null}},{{deviceInfo:1,ip:1}}).sort({{lastActiveAt:-1}}).limit(10).toArray(),e:d.auth_audit_log.find().sort({{createdAt:-1}}).limit(15).toArray()}})' 2>/dev/null""")

        if raw:
            d = json.loads(raw)
            CACHE['users'] = d.get('u',[])
            CACHE['sessions'] = d.get('s',[])
            CACHE['events'] = d.get('e',[])

        # Services
        svcs_raw = ssh("cd ~/piece && docker compose ps --format json 2>/dev/null")
        svcs = []
        for line in svcs_raw.split('\n'):
            if not line.strip(): continue
            try:
                s = json.loads(line)
                nm = s.get('Name','?').replace('piece-','').replace('-1','')
                st = s.get('Status','?')
                svcs.append((nm, 'healthy' in st.lower(), 'up' in st.lower()))
            except: pass
        CACHE['services'] = svcs
        CACHE['ts'] = time.strftime("%H:%M:%S")
    except:
        pass

class App(rumps.App):
    def __init__(self):
        super().__init__("🎬 ...", quit_button="Quit")

    @rumps.timer(30)
    def tick(self, _):
        self._do_fetch()

    @rumps.clicked("↻ Refresh")
    def manual(self, _):
        self._do_fetch()

    def _do_fetch(self):
        self.title = "🎬 ⟳"
        fetch()
        self._build()

    def _build(self):
        d = CACHE
        self.menu.clear()

        self.menu.add(rumps.MenuItem(f"Updated: {d['ts']}", callback=None))
        self.menu.add(rumps.separator)

        # Users
        uu = d['users']
        m = rumps.MenuItem(f"👥 Users ({len(uu)})")
        for u in uu:
            m.add(rumps.MenuItem(f"{u.get('email','?')} — {u.get('name','')}"))
        self.menu.add(m)

        # Sessions
        ss = d['sessions']
        m = rumps.MenuItem(f"🟢 Sessions ({len(ss)})")
        if not ss:
            m.add(rumps.MenuItem("No active sessions"))
        for s in ss:
            di = s.get('deviceInfo',{})
            m.add(rumps.MenuItem(f"{di.get('browser','?')} | {di.get('os','?')} | {s.get('ip','?')}"))
        self.menu.add(m)

        # Events
        ee = d['events']
        icons = {'login_success':'✅','login_failed':'❌','register':'🆕','logout':'🚪'}
        m = rumps.MenuItem(f"📋 Events ({len(ee)})")
        for ev in ee:
            t = ev.get('event','?')
            em = ev.get('email','')
            ic = icons.get(t,'📌')
            m.add(rumps.MenuItem(f"{ic} {t} {em}"))
        self.menu.add(m)

        # Services
        svcs = d['services']
        h = sum(1 for _,ok,_ in svcs if ok)
        self.title = f"🎬 {h}/{len(svcs)}" if svcs else "🎬 ?"
        m = rumps.MenuItem(f"🖥 Services ({h}/{len(svcs)})")
        for nm, ok, up in svcs:
            ic = "✅" if ok else ("🟡" if up else "❌")
            m.add(rumps.MenuItem(f"{ic} {nm}"))
        self.menu.add(m)

        self.menu.add(rumps.separator)
        self.menu.add(rumps.MenuItem("↻ Refresh", callback=self.manual))

if __name__ == "__main__":
    app = App()
    app._do_fetch()
    app.run()
