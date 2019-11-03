import drawFunction from './visualization';

drawFunction();

module.hot.accept('./visualization', () => {
  const newDrawFunction = require('./visualization').default;

  document.getElementsByClassName('chart')[0].innerHTML = '';

  newDrawFunction();
});
