/* Version number, the splash screen, and the opening of the app's single private scope (closed at the end of core/startup). */
const APP_VER = '1.07';
setTimeout(() => {
  const sp = document.getElementById('splash');
  if (sp) sp.remove();
}, 2200);
(function () {
  'use strict';
