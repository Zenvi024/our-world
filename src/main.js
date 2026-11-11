import './styles/base.css';
import './styles/title.css';
import './styles/world.css';
import './styles/calendar.css';
import './styles/charm.css';
import './styles/cozy.css';
import './styles/life.css';
import { currentRoute, navigate, onRouteChange } from './router.js';
import { initSession, getSession, onSessionChange } from './session.js';
import { mountTitle } from './screens/title.js';
import { mountWorld, isWorldRoute } from './screens/world.js';
import { installDirtTile } from './art/tiles.js';
import { installClickSounds, installMusic } from './lib/sound.js';
import { checkAdvancements } from './data/advancements.js';
import { showLandingNotices, showNewPokes, watchForPokes } from './lib/notices.js';
import { openChest } from './screens/chest.js';
import { startLive, stopLive, onLive } from './lib/live.js';
import { recordVisit } from './data/visits.js';

const root = document.getElementById('app');
const HOME = 'calendar';

let cleanupTitle = null; // set while the title screen is showing
let showWorldScreen = null; // set while the world frame is showing

function render() {
  const route = currentRoute();
  const signedIn = Boolean(getSession());

  // The title screen: the front door, and the only screen for signed-out visitors.
  if (route === '' || !signedIn) {
    if (route !== '') {
      navigate('');
      return;
    }
    showWorldScreen = null;
    if (!cleanupTitle) {
      document.title = 'Our Little World';
      cleanupTitle = mountTitle(root, { onEnter: () => navigate(HOME) });
      if (signedIn) {
        // The Play screen doubles as a little notice board.
        showLandingNotices({
          onOpenDay: (date) => {
            navigate(HOME);
            openChest(date);
          },
        });
      }
    }
    return;
  }

  if (!isWorldRoute(route)) {
    navigate(HOME);
    return;
  }

  if (cleanupTitle) {
    cleanupTitle();
    cleanupTitle = null;
  }
  if (!showWorldScreen) {
    showWorldScreen = mountWorld(root);
    checkAdvancements();
    showNewPokes(); // pokes, a partner feeling low, and new letters
    watchForPokes();
    recordVisit().catch(() => {});
  }
  showWorldScreen(route);
}

installDirtTile();
installClickSounds();
installMusic();
await initSession();
// Live updates start once someone is signed in, and stop when they leave.
const syncLive = () => (getSession() ? startLive() : stopLive());
syncLive();
onSessionChange(syncLive);
for (const topic of ['pokes', 'moods', 'letters']) onLive(topic, () => showNewPokes());
onRouteChange(render);
onSessionChange(render);
render();
