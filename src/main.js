import './styles/base.css';
import './styles/title.css';
import './styles/world.css';
import './styles/calendar.css';
import { currentRoute, navigate, onRouteChange } from './router.js';
import { initSession, getSession, onSessionChange } from './session.js';
import { mountTitle } from './screens/title.js';
import { mountWorld, isWorldRoute } from './screens/world.js';
import { installDirtTile } from './art/tiles.js';

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
  if (!showWorldScreen) showWorldScreen = mountWorld(root);
  showWorldScreen(route);
}

installDirtTile();
await initSession();
onRouteChange(render);
onSessionChange(render);
render();
