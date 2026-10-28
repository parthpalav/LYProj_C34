#!/bin/zsh
# Drive the dev-client app on the booted simulator without UI automation permissions.
# Needs Metro (npx expo start --dev-client), the app open, and `npm install` in this folder.
#
#   ./sim.sh login <email> <password>   sign in through the auth store
#   ./sim.sh nav <RouteName>            navigation.navigate(RouteName)
#   ./sim.sh back                       goBack() on the first navigator that can
#   ./sim.sh scroll <y>                 scroll every mounted ScrollView/FlatList to y
#   ./sim.sh press '<regex>'            call onPress of the first pressable whose label/text matches
#   ./sim.sh theme light|dark|system      set the app theme mode
#   ./sim.sh shot <name>                screenshot to ../after/<name>.png (OUT=dir to override)
set -e
D=${0:A:h}
OUT=${OUT:-$D/../after}

# Depth-first walk over every mounted React fiber; BODY runs per fiber `f` and may `return`.
walk() {
  node $D/cdp.mjs "(() => { const h = __REACT_DEVTOOLS_GLOBAL_HOOK__; for (const id of h.renderers.keys()) for (const root of h.getFiberRoots(id)) { const st = [root.current]; while (st.length) { const f = st.pop(); $1 if (f.sibling) st.push(f.sibling); if (f.child) st.push(f.child); } } return $2; })()"
}

case $1 in
  theme)
    node $D/cdp.mjs "(() => { const m = __r.getModules(); for (const [k, v] of (m instanceof Map ? m : Object.entries(m))) if (v && /src\/store\/useThemeStore\.ts$/.test(v.verboseName || '')) { __r(k).useThemeStore.getState().setMode('$2'); return 'theme $2'; } return 'theme store not found'; })()" ;;
  login)
    node $D/cdp.mjs "(() => { const m = __r.getModules(); for (const [k, v] of (m instanceof Map ? m : Object.entries(m))) if (v && /src\/store\/useAuthStore\.ts$/.test(v.verboseName || '')) { const s = __r(k).useAuthStore; s.getState().login({ email: '$2', password: '$3' }).then(() => s.getState().dismissWelcome()); return 'login started'; } return 'auth store not found'; })()" ;;
  nav)
    walk "const n = f.memoizedProps && f.memoizedProps.navigation; if (n && n.navigate && f.memoizedProps.route) { n.navigate('$2'); return 'ok'; }" "'no navigator'" ;;
  back)
    walk "const n = f.memoizedProps && f.memoizedProps.navigation; if (n && n.goBack && f.memoizedProps.route && n.canGoBack()) { n.goBack(); return 'back'; }" "'cannot go back'" ;;
  scroll)
    walk "const s = f.stateNode; try { if (s && s.scrollTo) s.scrollTo({ y: $2, animated: false }); else if (s && s.scrollToOffset) s.scrollToOffset({ offset: $2, animated: false }); } catch (e) {}" "'scrolled'" ;;
  press)
    # Label = accessibilityLabel + text of the first 60 descendants. Never point this at Save/Delete.
    # The pattern is JSON-encoded so regex escapes like \s survive the trip into JS.
    RE=$(printf '%s' "$2" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
    walk "const p = f.memoizedProps; if (p && typeof p.onPress === 'function' && typeof f.type !== 'string') { let t = ''; const q = [f.child]; let n = 0; while (q.length && n < 60) { const x = q.pop(); n++; if (!x) continue; const c = x.memoizedProps && x.memoizedProps.children; if (typeof c === 'string') t += c + ' '; if (Array.isArray(c)) c.forEach((y) => { if (typeof y === 'string') t += y + ' '; }); if (x.sibling) q.push(x.sibling); if (x.child) q.push(x.child); } const label = (p.accessibilityLabel || '') + ' | ' + t; if (new RegExp($RE).test(label)) { p.onPress({ nativeEvent: {} }); return 'pressed: ' + label.slice(0, 80); } }" "'not found'" ;;
  shot)
    mkdir -p $OUT
    xcrun simctl io booted screenshot $OUT/$2.png >/dev/null 2>&1
    sips -Z 800 $OUT/$2.png >/dev/null
    echo $OUT/$2.png ;;
  *)
    sed -n '2,12p' $0; exit 1 ;;
esac
