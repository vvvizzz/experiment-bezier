import drawFunction from './visualization';

drawFunction();

if (module.hot) {
  module.hot.accept('./visualization', () => {
    const newDrawFunction = require('./visualization').default;

    document.getElementsByClassName('chart')[0].innerHTML = '';

    newDrawFunction();
  });
}
