import { appendIconComponentCache } from "@elastic/eui/es/components/icon/icon";
import { icon as alert } from "@elastic/eui/es/components/icon/assets/warning";
import { icon as apps } from "@elastic/eui/es/components/icon/assets/apps";
import { icon as arrowDown } from "@elastic/eui/es/components/icon/assets/arrow_down";
import { icon as arrowEnd } from "@elastic/eui/es/components/icon/assets/arrowEnd";
import { icon as arrowLeft } from "@elastic/eui/es/components/icon/assets/arrow_left";
import { icon as arrowRight } from "@elastic/eui/es/components/icon/assets/arrow_right";
import { icon as arrowStart } from "@elastic/eui/es/components/icon/assets/arrowStart";
import { icon as arrowUp } from "@elastic/eui/es/components/icon/assets/arrow_up";
import { icon as check } from "@elastic/eui/es/components/icon/assets/check";
import { icon as checkInCircleFilled } from "@elastic/eui/es/components/icon/assets/checkInCircleFilled";
import { icon as cross } from "@elastic/eui/es/components/icon/assets/cross";
import { icon as empty } from "@elastic/eui/es/components/icon/assets/empty";
import { icon as faceSad } from "@elastic/eui/es/components/icon/assets/face_sad";
import { icon as home } from "@elastic/eui/es/components/icon/assets/home";
import { icon as info } from "@elastic/eui/es/components/icon/assets/info";
import { icon as lock } from "@elastic/eui/es/components/icon/assets/lock";
import { icon as lockOpen } from "@elastic/eui/es/components/icon/assets/lockOpen";
import { icon as logoKibana } from "@elastic/eui/es/components/icon/assets/logo_kibana";
import { icon as menu } from "@elastic/eui/es/components/icon/assets/menu";
import { icon as pinFilled } from "@elastic/eui/es/components/icon/assets/pin_filled";
import { icon as refresh } from "@elastic/eui/es/components/icon/assets/refresh";
import { icon as search } from "@elastic/eui/es/components/icon/assets/search";
import { icon as sortable } from "@elastic/eui/es/components/icon/assets/sortable";
import { icon as sortDown } from "@elastic/eui/es/components/icon/assets/sort_down";
import { icon as sortUp } from "@elastic/eui/es/components/icon/assets/sort_up";
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
  check,
  checkInCircleFilled,
  cross,
  empty,
  faceSad,
  home,
  info,
  lock,
  lockOpen,
  logoKibana,
  menu,
  pinFilled,
  refresh,
  search,
  sortable,
  sortDown,
  sortUp,
  training,
  warning,
});
