import { appendIconComponentCache } from "@elastic/eui/es/components/icon/icon";
import { icon as alert } from "@elastic/eui/es/components/icon/assets/warning";
import { icon as apps } from "@elastic/eui/es/components/icon/assets/apps";
import { icon as arrowDown } from "@elastic/eui/es/components/icon/assets/arrow_down";
import { icon as arrowEnd } from "@elastic/eui/es/components/icon/assets/arrowEnd";
import { icon as arrowLeft } from "@elastic/eui/es/components/icon/assets/arrow_left";
import { icon as arrowRight } from "@elastic/eui/es/components/icon/assets/arrow_right";
import { icon as arrowStart } from "@elastic/eui/es/components/icon/assets/arrowStart";
import { icon as arrowUp } from "@elastic/eui/es/components/icon/assets/arrow_up";
import { icon as boxesHorizontal } from "@elastic/eui/es/components/icon/assets/boxes_horizontal";
import { icon as check } from "@elastic/eui/es/components/icon/assets/check";
import { icon as checkInCircleFilled } from "@elastic/eui/es/components/icon/assets/checkInCircleFilled";
import { icon as copyClipboard } from "@elastic/eui/es/components/icon/assets/copy_clipboard";
import { icon as cross } from "@elastic/eui/es/components/icon/assets/cross";
import { icon as dot } from "@elastic/eui/es/components/icon/assets/dot";
import { icon as empty } from "@elastic/eui/es/components/icon/assets/empty";
import { icon as faceSad } from "@elastic/eui/es/components/icon/assets/face_sad";
import { icon as fullScreen } from "@elastic/eui/es/components/icon/assets/full_screen";
import { icon as fullScreenExit } from "@elastic/eui/es/components/icon/assets/fullScreenExit";
import { icon as home } from "@elastic/eui/es/components/icon/assets/home";
import { icon as info } from "@elastic/eui/es/components/icon/assets/info";
import { icon as lock } from "@elastic/eui/es/components/icon/assets/lock";
import { icon as lockOpen } from "@elastic/eui/es/components/icon/assets/lockOpen";
import { icon as logoKibana } from "@elastic/eui/es/components/icon/assets/logo_kibana";
import { icon as menu } from "@elastic/eui/es/components/icon/assets/menu";
import { icon as minusInCircle } from "@elastic/eui/es/components/icon/assets/minus_in_circle";
import { icon as pin } from "@elastic/eui/es/components/icon/assets/pin";
import { icon as pinFilled } from "@elastic/eui/es/components/icon/assets/pin_filled";
import { icon as popout } from "@elastic/eui/es/components/icon/assets/popout";
import { icon as question } from "@elastic/eui/es/components/icon/assets/question";
import { icon as refresh } from "@elastic/eui/es/components/icon/assets/refresh";
import { icon as search } from "@elastic/eui/es/components/icon/assets/search";
import { icon as sortable } from "@elastic/eui/es/components/icon/assets/sortable";
import { icon as sortDown } from "@elastic/eui/es/components/icon/assets/sort_down";
import { icon as sortUp } from "@elastic/eui/es/components/icon/assets/sort_up";
import { icon as stopFilled } from "@elastic/eui/es/components/icon/assets/stop_filled";
import { icon as training } from "@elastic/eui/es/components/icon/assets/training";
import { icon as warning } from "@elastic/eui/es/components/icon/assets/warning";

// EUI’s named icons use Webpack-specific dynamic imports. Register the icons
// used by Giant and its EUI controls before rendering so they also work in Vite.
// Add new named icons here, including those used internally by new EUI controls.
appendIconComponentCache({
  alert,
  apps,
  arrowDown,
  arrowEnd,
  arrowLeft,
  arrowRight,
  arrowStart,
  arrowUp,
  boxesHorizontal,
  check,
  checkInCircleFilled,
  copyClipboard,
  cross,
  dot,
  empty,
  faceSad,
  fullScreen,
  fullScreenExit,
  home,
  info,
  lock,
  lockOpen,
  logoKibana,
  menu,
  minusInCircle,
  pin,
  pinFilled,
  popout,
  question,
  refresh,
  search,
  sortable,
  sortDown,
  sortUp,
  stopFilled,
  training,
  warning,
});
