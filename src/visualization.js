import * as d3 from 'd3';
import Bezier from 'bezier-js';
import config from './config';
import clamp from 'lodash/clamp';
let gBezierPath = null;
import './styles.styl';
let upd = null;
var Mode = {
  kAdding : {value: 0, name: "Adding"},
  kSelecting : {value: 1, name: "Selecting"},
  kDragging: {value: 2, name: "Dragging"},
  kRemoving : {value: 3, name: "Removing"},
};

let gState = Mode.kSelecting;

const width = 4000;
const height = 4000;
const refsArray = [];
let mainCurvePoints = [];
let collectionsArray = [];
let targetLineCoords = null;
let resultsPoints = [];
const targetPoints = [];
let curves = [];
let inputIsFocused = false;
let prevValue = null;
let prevYValue = null;

const pointerCircleCoords = {
  x: -100,
  y: -100
};

const coordsInputsContainer = d3.select('.coords-inputs');
const coordsInputX = d3.select('.coords-input-x');
const coordsInputY = d3.select('.coords-input-y');

function swapItems(a, b) {
  const aCopy = a.map(i => i.map(j => j));
  aCopy.topOffset = a.topOffset;

  a.forEach((item, index) => {
    item[0] = b[index][0];
    item[1] = a.topOffset + (b[index][1] - b.topOffset);
  });

  b.topOffset = a[3][1] + config.refsDistance;

  b.forEach((item, index) => {
    item[0] = aCopy[index][0];
    item[1] = b.topOffset + (aCopy[index][1] - aCopy.topOffset);
  });
}

export default function draw() {
  const canvas = d3.select('.chart')
    .append('canvas')
    .attr('id', 'canvas')
    .attr('width', width)
    .attr('height', height)
    .node();

  const plusButton = d3.select('.plus-button');
  const minusButton = d3.select('.minus-button');
  const upButtonsContainer = document.querySelector('.up-buttons');
  const downButtonsContainer = document.querySelector('.down-buttons');
  const duplicateButtonsContainer = document.querySelector('.duplicate-buttons');
  const offsetInputsContainer = document.querySelector('.offset-inputs');
  const saveButton = d3.select('.save');

  const context = canvas.getContext('2d');

  saveButton.on('click', () => {
    const image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    window.location.href = image;
  });

  function addCurve(startingPoint) {
    const currentPoints = [
      [
        startingPoint[0],
        startingPoint[1] + config.defaultRefLineYOffset
      ],
      [
        startingPoint[0] + config.defaultCurveWidth / 2,
        startingPoint[1] + config.defaultRefLineYOffset
      ],
      [
        startingPoint[0] + config.defaultCurveWidth / 2,
        startingPoint[1] + config.defaultCurveHeight + config.defaultRefLineYOffset
      ],
      [
        startingPoint[0] + config.defaultCurveWidth,
        startingPoint[1] + config.defaultCurveHeight + config.defaultRefLineYOffset
      ]
    ];

    currentPoints.topOffset = startingPoint[1];

    refsArray.push(currentPoints);

    for (let k = 0; k < mainCurvePoints.length; k++) {
      const adder = currentPoints[3][1] - currentPoints[0][1] + config.refsDistance + config.defaultRefLineYOffset;
      mainCurvePoints[k][1] += adder;

      if (mainCurvePoints[k].firstMY) {
        mainCurvePoints[k].firstMY += adder;
      }

      if (mainCurvePoints[k].secondMY) {
        mainCurvePoints[k].secondMY += adder;
      }
    }

    plusButton
      .style('top', `${ currentPoints[3][1] + 20 }px`);

    plusButton
      .on('click', addNewCurve);

    minusButton
      .style('top', `${ currentPoints[3][1] + 20 }px`);

    minusButton
      .on('click', removeLastCurve);
  }

  addCurve(config.canvasStartingPoint);

  const mainCurveStartingPoint = [
    config.canvasStartingPoint[0],
    refsArray[refsArray.length - 1][3][1] + config.dividerOffset * 2
  ];

  mainCurvePoints = [
    [
      mainCurveStartingPoint[0],
      mainCurveStartingPoint[1] + config.defaultRefLineYOffset
    ],
    [
      mainCurveStartingPoint[0] + config.defaultCurveWidth - config.defaultMagnitude,
      mainCurveStartingPoint[1] + config.defaultRefLineYOffset
    ],
    [
      mainCurveStartingPoint[0] + config.defaultCurveWidth + config.defaultMagnitude,
      mainCurveStartingPoint[1] + config.defaultCurveHeight + config.defaultRefLineYOffset
    ],
    [
      mainCurveStartingPoint[0] + config.defaultCurveWidth * 2,
      mainCurveStartingPoint[1] + config.defaultCurveHeight + config.defaultRefLineYOffset
    ]
  ];

  mainCurvePoints.forEach((item, index) => {
    item.angle = Math.PI;
    item.firstM = config.defaultMagnitude;
    item.secondM = config.defaultMagnitude;

    if (index) {
      item.firstMX = item[0] - config.defaultMagnitude;
      item.firstMY = item[1];
    }

    if (index !== mainCurvePoints.length - 1) {
      item.secondMX = item[0] + config.defaultMagnitude;
      item.secondMY = item[1];
    }
  });

  window.addEventListener('keydown', function(event) {
    if (inputIsFocused) {
      return false;
    }

    event.preventDefault();

    if (event.keyCode === 32) { // space
      if (coordsInputsContainer.node().style.display === 'block') {
        return false;
      }
      const c = [
        mainCurvePoints[mainCurvePoints.length - 1][0] + 175,
        mainCurvePoints[mainCurvePoints.length - 1][1] + 50,
      ]

      mainCurvePoints[mainCurvePoints.length - 2].secondM = mainCurvePoints[mainCurvePoints.length - 1].secondM;

      const source = mainCurvePoints[mainCurvePoints.length - 1];
      source.secondMX = source[0] - config.defaultMagnitude * Math.cos(source.angle);
      source.secondMY = source[1] - config.defaultMagnitude * Math.sin(source.angle);

      c.angle = Math.PI;
      c.firstM = config.defaultMagnitude;
      c.secondM = config.defaultMagnitude;
      c.firstMX = c[0] - config.defaultMagnitude;
      c.firstMY = c[1];

      mainCurvePoints.push(c);

      gBezierPath.addPoint(new Point(c));

      update();
    }

    if (event.keyCode === 8) { // backspace
      if (coordsInputsContainer.node().style.display === 'block') {
        return false;
      }

      mainCurvePoints.pop();

      update();
    }
  });

  function addNewCurve() {
    const last = refsArray[refsArray.length - 1];

    addCurve([
      config.canvasStartingPoint[0],
      last[3][1] + config.refsDistance
    ]);

    update();
  }

  function removeLastCurve() {
    const removedCurvePoints = refsArray.pop();
    resultsPoints.pop();

    for (let k = 0; k < mainCurvePoints.length; k++) {
      const remover = removedCurvePoints[3][1] - removedCurvePoints[0][1] + config.refsDistance
        + config.defaultRefLineYOffset
      mainCurvePoints[k][1] -= remover;

      if (mainCurvePoints[k].firstMY) {
        mainCurvePoints[k].firstMY -= remover;
      }

      if (mainCurvePoints[k].secondMY) {
        mainCurvePoints[k].secondMY -= remover;
      }
    }

    plusButton
      .style('top', `${ refsArray[refsArray.length - 1][3][1] + 20 }px`);

    minusButton
      .style('top', `${ refsArray[refsArray.length - 1][3][1] + 20 }px`);

    d3.select(duplicateButtonsContainer.children[duplicateButtonsContainer.children.length - 1]).remove();
    d3.select(upButtonsContainer.children[duplicateButtonsContainer.children.length - 1]).remove();
    d3.select(downButtonsContainer.children[duplicateButtonsContainer.children.length - 1]).remove();
    d3.select(offsetInputsContainer.children[offsetInputsContainer.children.length - 1]).remove();

    update();
  }

  function update() {
    context.clearRect(0, 0, width, height);

    if (refsArray.length > 1) {
      minusButton.style('display', 'block');
    } else {
      minusButton.style('display', 'none');
    }

    curves.length = 0;

    refsArray.forEach((points, index) => {
      const curve = new Bezier(points.flat());
      curves.push(curve);

      let btnDown = d3.select(downButtonsContainer.children[index]);

      if (!btnDown.size()) {
        btnDown = d3.select(downButtonsContainer.appendChild(document.createElement('div')));
      }

      btnDown.on('click', () => {
        swapItems(refsArray[index], refsArray[index + 1]);

        update();
      });

      btnDown.style('display', 'block');
      btnDown.style('top', `${ points.topOffset }px`);

      if (index === refsArray.length - 1) {
        btnDown.style('display', 'none');
      }

      let btnUp = d3.select(upButtonsContainer.children[index]);

      if (!btnUp.size()) {
        btnUp = d3.select(upButtonsContainer.appendChild(document.createElement('div')));
      }

      btnUp.on('click', () => {
        swapItems(refsArray[index - 1], refsArray[index]);

        update();
      });

      btnUp.style('display', 'block');
      btnUp.style('top', `${ points.topOffset }px`);

      if (index === 0) {
        btnUp.style('display', 'none');
      }

      let btnDplc = d3.select(duplicateButtonsContainer.children[index]);

      if (!btnDplc.size()) {
        btnDplc = d3.select(duplicateButtonsContainer.appendChild(document.createElement('div')));
      }

      btnDplc.on('click', () => {
        const newItem = [[],[],[],[]];

        newItem.topOffset = refsArray[index][3][1] + config.refsDistance;

        refsArray[index].forEach((item, indx) => {
          newItem[indx][0] = item[0];
          newItem[indx][1] = newItem.topOffset + (item[1] - refsArray[index].topOffset);
        });

        const maxTop = newItem[3][1] - newItem.topOffset + config.refsDistance;

        for (let i = index + 1; i < refsArray.length; i++) {
          refsArray[i].forEach((item) => {
            item[1] = item[1] + maxTop;
          });

          refsArray[i].topOffset = refsArray[i].topOffset + maxTop;
        }

        mainCurvePoints.forEach(item => {
          item[1] = item[1] + maxTop;

          if (item.firstMY) {
            item.firstMY = item.firstMY + maxTop;
          }

          if (item.secondMY) {
            item.secondMY = item.secondMY + maxTop;
          }
        });

        refsArray.splice(index + 1, 0, newItem);

        update();
      });

      btnDplc.style('top', `${ points.topOffset }px`);

      let offsetInput = d3.select(offsetInputsContainer.children[index]);

      if (!offsetInput.size() && (!index || (index === 1 && (0 in targetPoints)) || (index > 1 && (index - 2 in resultsPoints)))) {
        const input = document.createElement('input');
        input.type = "text";
        offsetInput = d3.select(offsetInputsContainer.appendChild(input));

        offsetInput.on('focus', function() {
          inputIsFocused = true;
          prevValue = parseInt(this.value, 10);
        });

        offsetInput.on('blur', function() {
          inputIsFocused = false;

          const index = Array.prototype.indexOf.call(offsetInputsContainer.children, offsetInput.node());
          const value = parseInt(this.value, 10) + config.canvasStartingPoint[0];

          if (!index && (!value || value < config.canvasStartingPoint[0])) {
            // this.focus();
            alert('Укажите неотрицательное значение');
            return false;
          }

          if (index && value < (resultsPoints[index - 2] || targetPoints[0])) {
            // this.focus();
            alert(`Укажите значение от ${ (resultsPoints[index - 2] || targetPoints[0]) - 100 }`);
            return false;
          }

          if (prevValue) {
            const diff = value - config.canvasStartingPoint[0] - prevValue;

            for(let j = index + 1; j < offsetInputsContainer.children.length; j++) {
              const inputNode = d3.select(offsetInputsContainer.children[j]);
              const inputValue = parseInt(inputNode.property('value'), 10);
              inputNode.property('value', inputValue + diff);
              resultsPoints[j - 1] = inputValue + diff + config.canvasStartingPoint[0];
            }
          }

          if (index) {
            resultsPoints[index - 1] = value;
          } else {
            targetPoints[0] = value;
          }

          update();
        });
      }

      offsetInput.style('top', `${ points.topOffset + 30 }px`);

      plusButton
        .style('top', `${ refsArray[refsArray.length - 1][3][1] + 20 }px`);

      minusButton
        .style('top', `${ refsArray[refsArray.length - 1][3][1] + 20 }px`);

      drawSkeleton(context, curve, refsArray[index]);
    });

    // divider
    const dividerStartCoords = {
      x: config.canvasStartingPoint[0],
      y: refsArray[refsArray.length - 1][3][1] + config.dividerOffset
    };

    const dividerEndCoords = {
      x: width,
      y: refsArray[refsArray.length - 1][3][1] + config.dividerOffset
    };

    drawLine(context, dividerStartCoords, dividerEndCoords, {
      color: config.dividerLineColor, width: config.dividerLineWidth
    });

    pointerCircleCoords.text = [
      pointerCircleCoords.x - mainCurvePoints[0][0],
      pointerCircleCoords.y - mainCurvePoints[0][1],
    ];

    // pointer circle
    drawCircle(
      context,
      pointerCircleCoords,
      8,
      {
        width: config.circleWidth,
        color: config.circleColor
      }
    );

    mainCurvePoints.forEach((item, index) => {
      if (!index) {
        gBezierPath = new BezierPath(new Point(item));
      } else {
        gBezierPath.addPoint(new Point(item));
      }
    });

    gBezierPath.draw(context);

    const horizontalConnectLineEndCoords = {
      x: width,
      y: mainCurvePoints[mainCurvePoints.length - 1][1]
    };

    const horizontalConnectMainLineConfig = {
      color: config.mainLineColor,
      width: config.mainLineWidth
    };

    drawLine(
      context,
      {
        x: mainCurvePoints[mainCurvePoints.length - 1][0],
        y: mainCurvePoints[mainCurvePoints.length - 1][1],
      },
      horizontalConnectLineEndCoords,
      horizontalConnectMainLineConfig
    );

    if (targetPoints.length) {
      targetPoints.forEach((x, index) => {
        let y = null;

        if (x > mainCurvePoints[mainCurvePoints.length - 1][0]) {
          y = mainCurvePoints[mainCurvePoints.length - 1][1];
        } else {
          y = findYatX(x, context);
        }

        const p = {
          x,
          y
        };

        p.text = [
          p.x - mainCurvePoints[0][0],
          p.y - mainCurvePoints[0][1],
        ]

        if (index === 0) {
          targetLineCoords = [{
            x,
            y,
          },{
            x,
            y: y + refsArray[0][0][1] - refsArray[0].topOffset
          }];

          let prevVal = null;

          for(let i = refsArray[0][0][0]; i <= refsArray[0][3][0]; i++) {
            const distanceOptions = {
              cubicBezier: {
                xs:[
                  refsArray[0][0][0],
                  refsArray[0][1][0],
                  refsArray[0][2][0],
                  refsArray[0][3][0]
                ],
                ys:[
                  refsArray[0][0][1],
                  refsArray[0][1][1],
                  refsArray[0][2][1],
                  refsArray[0][3][1]
                ]
              },
              x: i
            };

            const distance = getValOnCubicBezier_givenXorX(distanceOptions) - refsArray[0].topOffset;

            let bezierY = null;
            const currentX = x + i - config.canvasStartingPoint[0];

            if (currentX > mainCurvePoints[mainCurvePoints.length - 1][0]) {
              bezierY = mainCurvePoints[mainCurvePoints.length - 1][1];
            } else {
              const result = findYatX(currentX, context, prevVal);
              bezierY = result;
              prevVal = result;
            }

            if (distance) {
              targetLineCoords.push({
                x: x + i - config.canvasStartingPoint[0],
                y: bezierY + distance
              });
            }
          }

          prevVal = null;

          targetLineCoords.push({
            x: width,
            y: targetLineCoords[targetLineCoords.length - 2].y
          });

          var line = d3.line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveLinear)
            .context(context);

          context.beginPath();
          line(targetLineCoords);
          context.lineWidth = config.targetLineWidth;
          context.strokeStyle = config.targetLineColor;
          context.stroke();
        }

        drawCircle(
          context,
          p,
          4,
          {
            width: config.targetPointWidth * 2,
            color: config.targetPointColor
          }
        );
      });
    }

    if (resultsPoints.length) {
      collectionsArray = [];

      resultsPoints.forEach((xPos, itemIndex) => {
        let collection = targetLineCoords;

        if (itemIndex) {
          collection = collectionsArray[itemIndex - 1];
        }
        const index = Math.ceil(xPos) - collection[0].x + 1;

        const pointCoords = {
          x: xPos,
          y: collection[index]
            ? collection[index].y
            : collection[collection.length - 1].y
        };

        pointCoords.text = [
          pointCoords.x - config.canvasStartingPoint[0],
          pointCoords.y - targetLineCoords[0].y,
        ];

        drawCircle(
          context,
          pointCoords,
          4,
          {
            width: config.targetPointWidth * 2,
            color: config.targetPointColor
          }
        );

        const iteratorSource = refsArray[itemIndex + 1];

        const resultLineCoords = [
          pointCoords,
          {
            x: pointCoords.x,
            y: pointCoords.y + iteratorSource[0][1] - iteratorSource.topOffset
          }
        ];

        for(let i = iteratorSource[0][0]; i < iteratorSource[iteratorSource.length - 1][0]; i++) {
          const distanceOptions = {
            cubicBezier: {
              xs:[
                iteratorSource[0][0],
                iteratorSource[1][0],
                iteratorSource[2][0],
                iteratorSource[3][0]
              ],
              ys:[
                iteratorSource[0][1],
                iteratorSource[1][1],
                iteratorSource[2][1],
                iteratorSource[3][1]
              ]
            },
            x: i
          };

          const distance = getValOnCubicBezier_givenXorX(distanceOptions) - iteratorSource.topOffset;

          if (distance) {
            let source = collection[index + i - config.canvasStartingPoint[0]];

            if (!source || !collection[index]) {
              source = collection[collection.length - 1];
            }

            resultLineCoords.push({
              x: collection[index]
                ? collection[index].x + i - config.canvasStartingPoint[0]
                : xPos + i - config.canvasStartingPoint[0],
              y: source.y + distance
            });
          }
        }

        resultLineCoords.push({
          x: width,
          y: resultLineCoords[resultLineCoords.length - 1].y
        });

        collectionsArray.push(resultLineCoords);

        var line = d3.line()
          .x(d => d.x)
          .y(d => d.y)
          .curve(d3.curveCatmullRom)
          .context(context);

        context.beginPath();
        line(resultLineCoords);
        context.lineWidth = config.targetLineWidth;
        context.strokeStyle = config.targetLineColor;
        context.stroke();
      });
    }
  }
upd = update;

  d3.select(context.canvas)
    .call(drag, {radius: 20, refsArray, update})
    .call(update)
    .node();

  d3.select(context.canvas)
    .on('click', handleClick);

  function handleKeyDown() {
    if (d3.event.keyCode === 13) {
      let x = parseInt(coordsInputX.node().value, 10);
      let y = parseInt(coordsInputY.node().value, 10);
      
      if (inputProps.isHandleInput) {
        x += config.canvasStartingPoint[0];
        y += mainCurvePoints[0][1];

        const isFirst = inputProps.isFirst;
        const _index = inputProps.handleIndex;
        const source = inputProps.point;
        const xDelta = x - source[0];
        const yDelta = y - source[1];

        let _magnitude = Math.sqrt(Math.pow(xDelta, 2) + Math.pow(yDelta, 2));
        let _angle = null;

        source[`${ inputProps.path }X`] = source[0] + xDelta;
        source[`${ inputProps.path }Y`] = source[1] + yDelta;

        mainCurvePoints[_index][isFirst ? 'firstM' : 'secondM'] = _magnitude;

        var tryAngle = Math.atan(yDelta /xDelta);

        if (!isNaN(tryAngle)) {
          _angle = tryAngle;
          if (xDelta < 0)
            _angle += Math.PI;
        }

        // update heighbour
        const path = inputProps.path === 'firstM' ? 'secondM' : 'firstM';

        source[`${ path }X`] = source[0] - source[!isFirst ? 'firstM' : 'secondM'] * Math.cos( _angle);
        source[`${ path }Y`] = source[1] - source[!isFirst ? 'firstM' : 'secondM'] * Math.sin( _angle);

        if (isFirst) {
          mainCurvePoints[_index].angle = Math.PI + _angle;
        } else {
          if (_index !== mainCurvePoints.length - 1) {
            mainCurvePoints[_index + 1].angle = _angle;
          } else {
            mainCurvePoints[_index].angle = _angle;
          }
        }

        inputProps = {};
        coordsInputsContainer.style('display', 'none');
        update();

        return false;
      }

      if (!inputProps.isMainCurve) {
        if (inputProps.isLeftHandler) {
          if (y < 0) {
            alert('Координата Y не может быть отрицательной');
            return false;
          }

          const yLimit = refsArray[inputProps.setIndex][3][1] - refsArray[inputProps.setIndex].topOffset;

          if (y > yLimit) {
            alert('Координата Y не может быть больше ' + yLimit);
            return false;
          }

          refsArray[inputProps.setIndex][0][0] = x + config.canvasStartingPoint[0];
          refsArray[inputProps.setIndex][0][1] = y + refsArray[inputProps.setIndex].topOffset;
          refsArray[inputProps.setIndex][1][1] = y + refsArray[inputProps.setIndex].topOffset;
        }


        if (inputProps.isRightHandler) {
          const xLimit = refsArray[inputProps.setIndex][1][0] - config.canvasStartingPoint[0];

          if (x < xLimit) {
            alert('Координата X не может быть меньше ' + xLimit);
            return false;
          }

          const yLimit = refsArray[inputProps.setIndex][0][1] - refsArray[inputProps.setIndex].topOffset;

          if (y < yLimit) {
            alert('Координата Y не может быть меньше ' + yLimit);
            return false;
          }

          refsArray[inputProps.setIndex][3][0] = x + config.canvasStartingPoint[0];
          refsArray[inputProps.setIndex][3][1] = y + refsArray[inputProps.setIndex].topOffset;
          refsArray[inputProps.setIndex][2][1] = y + refsArray[inputProps.setIndex].topOffset;

          const diff = prevYValue - y;

          for (let i = inputProps.setIndex + 1; i < refsArray.length; i++) {
            for (let j = 0; j < refsArray[i].length; j++) {
              refsArray[i][j][1] -= diff;
            }

            refsArray[i].topOffset = refsArray[i - 1][3][1] + config.refsDistance;
          }

          for (let k = 0; k < mainCurvePoints.length; k++) {
            mainCurvePoints[k][1] -= diff;

            if (mainCurvePoints[k].firstMY) {
              mainCurvePoints[k].firstMY -= diff;
            }

            if (mainCurvePoints[k].secondMY) {
              mainCurvePoints[k].secondMY -= diff;
            }
          }
        }

        if (inputProps.isTuner) {
          if (x < 0) {
            alert('Координата X не может быть отрицательной');
            return false;
          }

          const xLimit = refsArray[inputProps.setIndex][3][0] - config.canvasStartingPoint[0];

          if (x > xLimit) {
            alert('Координата X не может быть больше ' + xLimit);
            return false;
          }

          refsArray[inputProps.setIndex][1][0] = x + config.canvasStartingPoint[0];
          refsArray[inputProps.setIndex][2][0] = x + config.canvasStartingPoint[0];
        }
      } else {
        if (x < 0) {
          alert('Координата X не может быть отрицательной');
          return false;
        }

        if (y < 0) {
          alert('Координата Y не может быть отрицательной');
          return false;
        }

        const xDiff = x + config.canvasStartingPoint[0] - mainCurvePoints[inputProps.pointIndex][0];
        const yDiff = y + mainCurvePoints[0][1] - mainCurvePoints[inputProps.pointIndex][1];

        mainCurvePoints[inputProps.pointIndex][0] = x + config.canvasStartingPoint[0];
        mainCurvePoints[inputProps.pointIndex][1] = y + mainCurvePoints[0][1];

        if (mainCurvePoints[inputProps.pointIndex].firstMX) {
          mainCurvePoints[inputProps.pointIndex].firstMX += xDiff;
        }

        if (mainCurvePoints[inputProps.pointIndex].secondMX) {
          mainCurvePoints[inputProps.pointIndex].secondMX += xDiff;
        }

        if (mainCurvePoints[inputProps.pointIndex].firstMY) {
          mainCurvePoints[inputProps.pointIndex].firstMY += yDiff;
        }

        if (mainCurvePoints[inputProps.pointIndex].secondMY) {
          mainCurvePoints[inputProps.pointIndex].secondMY += yDiff;
        }
      }

      inputProps = {};
      coordsInputsContainer.style('display', 'none');
      update();
    }
  }

  coordsInputX.on('keypress', handleKeyDown);
  coordsInputY.on('keypress', handleKeyDown);
  coordsInputX.on('focus', handleFocus);
  coordsInputY.on('focus', handleFocus);
  coordsInputX.on('blur', handleBlur);
  coordsInputY.on('blur', handleBlur);

  context.canvas.addEventListener('dblclick', (event) => {
    const handlesCoords = [];

    mainCurvePoints.forEach((point, index) => {
      if (index !== 0) {
        const a = [point.firstMX, point.firstMY];

        a.point = point;
        a.path = 'firstM';
        handlesCoords.push(a);
      }

      if (index !== mainCurvePoints.length - 1) {
        const a = [point.secondMX, point.secondMY];

        a.point = point;
        a.path = 'secondM';
        handlesCoords.push(a);
      }
    });

    handlesCoords.forEach((item, index) => {
      item.isFirst = !(index % 2);
      item.index = Math.floor(index/2);

      if (index === handlesCoords.length - 1) {
        item.index++;
      }
    });

    let S = null;
    let R = 16;
    let ind = null;
    let isFirst = null;
    let point = null;
    let path = null;

    for (const p of handlesCoords) {
      const top = window.pageYOffset || document.documentElement.scrollTop;
      const left = window.pageXOffset || document.documentElement.scrollLeft;
      let r = Math.hypot(event.clientX + left - p[0], event.clientY + top - p[1]);

      if (r < R) {
        R = r;
        S = p;
        ind = S.index;
        isFirst = S.isFirst;
        point = S.point;
        path = S.path;
      }
    }

    if (!S) {
      return false;
    }

    coordsInputsContainer
      .style('left', `${ S[0] + 15 }px`)
      .style('top', `${ S[1] + 15 }px`)
      .style('display', 'block');

    coordsInputX.node().focus();

    coordsInputX.property('value', S[0] - config.canvasStartingPoint[0]);
    coordsInputY.property('value', S[1] - mainCurvePoints[0][1]);

    inputIsFocused = true;
    inputProps.isHandleInput = true;
    inputProps.handleIndex = ind;
    inputProps.isFirst = isFirst;
    inputProps.point = point;
    inputProps.path = path;
  });

  let hoverOn = null;

  let inputProps = {};

  function handleFocus() {
    inputIsFocused = true;
    prevYValue = parseInt(this.value, 10);
  };

  function handleBlur() {
    inputIsFocused = false;
  };

  function handleClick() {
    let S = null;
    let R = 16;
    inputProps = {};

    refsArray.concat([mainCurvePoints]).forEach((points, index) => {
      for (const p of points) {
        const top = window.pageYOffset || document.documentElement.scrollTop;
        const left = window.pageXOffset || document.documentElement.scrollLeft;
        let r = Math.hypot(d3.event.x + left - p[0], d3.event.y + top - p[1]);
        if (r < R) {
          R = r;
          S = p;

          inputProps.isMainCurve = mainCurvePoints === points;
          inputProps.isLeftHandler = points.indexOf(p) === 0;
          inputProps.isRightHandler = points.indexOf(p) === (points.length - 1);
          inputProps.isTuner = points.indexOf(p) !== 0 && points.indexOf(p) !== (points.length - 1);
          inputProps.setIndex = index;
          inputProps.pointIndex = points.indexOf(p);
        }
      }
    });

    if (S) {
      coordsInputX.attr('disabled', null);
      coordsInputX.attr('title', '');
      coordsInputY.attr('disabled', null);
      coordsInputY.attr('title', '');

      coordsInputX.property('value', S[0] - config.canvasStartingPoint[0]);

      if (inputProps.isMainCurve) {
        coordsInputY.property('value', S[1] - mainCurvePoints[0][1]);

        if (inputProps.pointIndex === 0) {
          coordsInputX.attr('disabled', true);
          coordsInputX.attr('title', 'Изменение координаты X для этой точки не возможно');
        }
      } else {
        coordsInputY.property('value', S[1] - refsArray[inputProps.setIndex].topOffset);

        if (inputProps.isLeftHandler) {
          coordsInputX.attr('disabled', true);
          coordsInputX.attr('title', 'Изменение координаты X для этой точки не возможно');
        }

        if (inputProps.isTuner) {
          coordsInputY.attr('disabled', true);
          coordsInputY.attr('title', 'Изменение координаты Y для этой точки не возможно');
        }
      }

      coordsInputsContainer
        .style('left', `${ S[0] + 15 }px`)
        .style('top', `${ S[1] + 15 }px`)
        .style('display', 'block');

      if (coordsInputX.attr('disabled')) {
        coordsInputY.node().focus();
      } else {
        coordsInputX.node().focus();
      }

      inputIsFocused = true;


    } else {
      // const pos = new Point(d3.mouse(this));
      // handleUp(pos, canvas);
    }

    const [x,y] = d3.mouse(this);

    if (y >= mainCurvePoints[0][1] && hoverOn === 'targetLine') {
      const currentTargetPointXPosition = targetPoints[0];
      targetPoints[0] = Math.ceil(x);

      if (resultsPoints.length) {
        resultsPoints = resultsPoints.map(xPos => xPos + targetPoints[0] - currentTargetPointXPosition);
      }

      update();
    }

    if (hoverOn === 'resultsLine') {
      let theIndex = null;

      [targetLineCoords].concat(collectionsArray).forEach((arr, idx) => {
        const index = Math.ceil(x) - arr[0].x + 1;
        const item = index > arr.length ? arr[arr.length - 1] : arr[index];

        if (item && item.y <= y + 3 && item.y >= y - 3) {
          theIndex = idx;
        }
      });

      if (theIndex === collectionsArray.length) {
        if (refsArray.length > collectionsArray.length + 1) {
          resultsPoints.push(Math.ceil(x));

          update();
        } else if (theIndex >= collectionsArray.length) {
          alert('Для отрисовки необходимо добавить ещё одну референсную линию');
        }
      } else if (theIndex < collectionsArray.length) {
        const prev = resultsPoints[theIndex];
        resultsPoints[theIndex] = Math.ceil(x);

        for(let i = theIndex + 1; i < resultsPoints.length; i++) {
          resultsPoints[i] = resultsPoints[i] + (Math.ceil(x) - prev);
        }

        update();
      }
    }
  }

  function drag(selection, {refsArray, radius, update}) {
    function dragsubject() {
      let S = null;
      let R = radius;
      let isLeftHandler = false;
      let isRightHandler = false;
      let isTuner = false;
      let setIndex = null;
      let pointIndex = null;
      let isMainCurve;

      refsArray.concat([mainCurvePoints]).forEach((points, index) => {
        for (const p of points) {
          let r = Math.hypot(d3.event.x - p[0], d3.event.y - p[1]);
          if (r < R) {
            R = r;
            S = p;

            isMainCurve = mainCurvePoints === points;
            isLeftHandler = points.indexOf(p) === 0;
            isRightHandler = points.indexOf(p) === (points.length - 1);
            isTuner = points.indexOf(p) !== 0 && points.indexOf(p) !== (points.length - 1);
            setIndex = index;
            pointIndex = points.indexOf(p);
          }
        }
      });

      if (!S) return false;

      return {
        x: S[0],
        y: S[1],
        point: S,
        isLeftHandler,
        isRightHandler,
        isTuner,
        pointIndex,
        setIndex,
        isMainCurve
      };
    }

    function dragged() {
      const {
        isLeftHandler,
        isRightHandler,
        isMainCurve,
        isTuner,
        setIndex,
        pointIndex,
      } = d3.event.subject;

      const array = isMainCurve ? mainCurvePoints : refsArray[setIndex];

      if (!array) return false;

      const maxTop = array[3][1];

      if (!isLeftHandler && !isRightHandler && !isMainCurve) {
        array[1][0] = clamp(d3.event.x, array[0][0], array[3][0]);
        array[2][0] = clamp(d3.event.x, array[0][0], array[3][0]);
      }

      if (!isTuner) {
        let yCoord = null;

        if (isLeftHandler) {
          const yDiff = clamp(d3.event.y, array.topOffset, array[array.length - 1][1]) - array[1][1];

          yCoord = clamp(d3.event.y, array.topOffset, array[array.length - 1][1]);
          array[1][1] = yCoord;

          if (isMainCurve) {
            if (array[pointIndex].firstMY) {
              array[pointIndex].firstMY += yDiff;
            }

            if (array[pointIndex].secondMY) {
              array[pointIndex].secondMY += yDiff;
            }

            if (array[pointIndex + 1].firstMY) {
              array[pointIndex + 1].firstMY += yDiff;
            }

            if (array[pointIndex + 1].secondMY) {
              array[pointIndex + 1].secondMY += yDiff;
            }
          }
        }

        if (isRightHandler && !isMainCurve) {
          yCoord = clamp(d3.event.y, array[0][1], Infinity);
          array[2][1] = yCoord;

          const leftEdge = targetPoints.length && isMainCurve
            ? targetPoints[0] > array[2][0] ? targetPoints[0] : array[2][0]
            : array[2][0];

          array[3][0] = clamp(d3.event.x, leftEdge, width);
        }

        if (isMainCurve) {
          d3.event.subject.point[1] = d3.event.y;
        } else {
          d3.event.subject.point[1] = yCoord;
        }
      }

      if (isMainCurve && !isLeftHandler) {
        const xDiff = d3.event.x - array[pointIndex][0];
        const yDiff = clamp(d3.event.y, array[0][1], Infinity) - array[pointIndex][1];

        array[pointIndex][0] = d3.event.x;
        array[pointIndex][1] = clamp(d3.event.y, array[0][1], Infinity);

        if (array[pointIndex].firstMX) {
          array[pointIndex].firstMX += xDiff;
        }

        if (array[pointIndex].secondMX) {
          array[pointIndex].secondMX += xDiff;
        }

        if (array[pointIndex].firstMY) {
          array[pointIndex].firstMY += yDiff;
        }

        if (array[pointIndex].secondMY) {
          array[pointIndex].secondMY += yDiff;
        }
      }

      if (!isMainCurve) {
        if (isRightHandler && setIndex !== refsArray.length - 1) {
          for (let i = setIndex + 1; i < refsArray.length; i++) {
            for (let j = 0; j < refsArray[i].length; j++) {
              refsArray[i][j][1] += d3.event.subject.point[1] - maxTop;
            }

            refsArray[i].topOffset = refsArray[i - 1][3][1] + config.refsDistance;
          }
        }

        if (isRightHandler) {
          for (let k = 0; k < mainCurvePoints.length; k++) {
            mainCurvePoints[k][1] += d3.event.subject.point[1] - maxTop;

            if (mainCurvePoints[k].firstMY) {
              mainCurvePoints[k].firstMY += d3.event.subject.point[1] - maxTop;
            }

            if (mainCurvePoints[k].secondMY) {
              mainCurvePoints[k].secondMY += d3.event.subject.point[1] - maxTop;
            }
          }

          plusButton.style('top', `${ refsArray[refsArray.length - 1][3][1] + 30 }px`);
        }
      }
    }

    selection.call(d3.drag()
      .subject(dragsubject)
      .on("drag", dragged)
      .on("start.update drag.update end.update", update));
  }

  function drawLine(ctx, p1, p2, options) {
    ctx.strokeStyle = options.color || config.defaultLineColor;
    ctx.lineWidth = options.width || config.defaultLineWidth;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  function drawCircle(ctx, p, r, options) {
    if (options) {
      ctx.lineWidth = options.width;
      ctx.strokeStyle = options.color;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, 2*Math.PI);
    ctx.stroke();

    context.font = "10px Arial";
    context
      .fillText(`${ (p.text ? p.text[0] : p.x).toFixed(0) } ${ (p.text ? p.text[1] : p.y).toFixed(0) }`,p.x + 5,p.y - 5);

    if (options) {
      ctx.lineWidth = config.defaultLineColor;
      ctx.strokeStyle = config.defaultLineWidth;
    }
  }

  function drawPoints(ctx, points, options, array) {
    ctx.strokeStyle = options.color || config.defaultLineColor;

    points.forEach((p, index) => {
      let text = '';

      if (index === 0) {
        text = [0, array[0][1] - array.topOffset];
      } else if (index === 1) {
        text = [ array[1][0] - array[0][0], array[1][1] - array.topOffset ];
      } else if (index === 2) {
        text = [ array[2][0] - array[0][0], array[2][1] - array.topOffset ];
      } else if (index === 3) {
        text = [ array[3][0] - array[0][0], array[3][1] - array.topOffset ];
      }

      p.text = text;

      drawCircle(ctx, p, 6);
    });
  }

  function drawSkeleton(ctx, curve, array, isMain) {
    var pts = curve.points;

    // horizontal line
    const horizontalLineStartCoords = {
      x: pts[0].x,
      y: array.topOffset
    };

    const horizontalLineEndCoords = {
      x: width,
      y: array.topOffset
    };

    const horizontalLineConfig = {
      width: config.refHorizontalLineWidth,
      color: config.refHorizontalLineColor
    };

    drawLine(ctx, horizontalLineStartCoords, horizontalLineEndCoords, horizontalLineConfig);

    // left handler line
    drawLine(ctx, pts[0], pts[1], {color: 'lightgrey'});

    // right handler line
    drawLine(ctx, pts[2], pts[3], {color: 'lightgrey'});

    // handler circles
    drawPoints(ctx, pts, {color: 'black'}, array);

    // left connect line
    const leftConnectLineStartCoords = horizontalLineStartCoords;
    const leftConnectLineEndCoords = pts[0];

    const connectLineConfig = {
      color: config.connectLineColor,
      width: config.connectLineWidth,
    };

    drawLine(ctx, leftConnectLineStartCoords, leftConnectLineEndCoords, connectLineConfig);

    // right connect line
    const rightConnectLineStartCoords = {
      x: pts[3].x,
      y: horizontalLineStartCoords.y
    };

    const rightConnectLineEndCoords = pts[3];

    drawLine(ctx, rightConnectLineStartCoords, rightConnectLineEndCoords, connectLineConfig);

    // horizontal connect line
    const horizontalConnectLineStartCoords = pts[3];
    const horizontalConnectLineEndCoords = {
      x: width,
      y: pts[3].y
    };

    const horizontalConnectMainLineConfig = {
      color: config.mainLineColor,
      width: config.mainLineWidth
    };

    drawLine(
      ctx,
      horizontalConnectLineStartCoords,
      horizontalConnectLineEndCoords,
      isMain ? horizontalConnectMainLineConfig : connectLineConfig
    );

    // curve
    drawCurve(context, curve, isMain);
  }

  function drawCurve(ctx, curve, isMain) {
    ctx.lineWidth = config.refLineWidth * (isMain ? 2 : 1);
    ctx.strokeStyle = isMain ? config.mainLineColor : config.refLineColor;

    ctx.beginPath();
    var p = curve.points;
    ctx.moveTo(p[0].x, p[0].y);
    if (p.length === 3) {
      ctx.quadraticCurveTo(
        p[1].x, p[1].y,
        p[2].x, p[2].y
      );
    }
    if (p.length === 4) {
      ctx.bezierCurveTo(
        p[1].x, p[1].y,
        p[2].x, p[2].y,
        p[3].x, p[3].y
      );
    }
    ctx.stroke();
    ctx.closePath();
    ctx.lineWidth = config.defaultLineWidth;
  }
}

function getValOnCubicBezier_givenXorX(options) {
  /*
  options = {
   cubicBezier: {xs:[x1, x2, x3, x4], ys:[y1, y2, y3, y4]};
   x: NUMBER //this is the known x, if provide this must not provide y, a number for x will be returned
   y: NUMBER //this is the known y, if provide this must not provide x, a number for y will be returned
  }
  */
  if ('x' in options && 'y' in options) {
    throw new Error('cannot provide known x and known y');
  }
  if (!('x' in options) && !('y' in options)) {
    throw new Error('must provide EITHER a known x OR a known y');
  }

  var x1 = options.cubicBezier.xs[0];
  var x2 = options.cubicBezier.xs[1];
  var x3 = options.cubicBezier.xs[2];
  var x4 = options.cubicBezier.xs[3];

  var y1 = options.cubicBezier.ys[0];
  var y2 = options.cubicBezier.ys[1];
  var y3 = options.cubicBezier.ys[2];
  var y4 = options.cubicBezier.ys[3];

  var LUT = {
    x: [],
    y: []
  }

  for(var i=0; i<5000; i++) {
    var t = i/5000;
    LUT.x.push( (1-t)*(1-t)*(1-t)*x1 + 3*(1-t)*(1-t)*t*x2 + 3*(1-t)*t*t*x3 + t*t*t*x4 );
    LUT.y.push( (1-t)*(1-t)*(1-t)*y1 + 3*(1-t)*(1-t)*t*y2 + 3*(1-t)*t*t*y3 + t*t*t*y4 );
  }

  if ('x' in options) {
    var knw = 'x'; //known
    var unk = 'y'; //unknown
  } else {
    var knw = 'y'; //known
    var unk = 'x'; //unknown
  }

  for (var i=1; i<5000; i++) {
    if (options[knw] >= LUT[knw][i] && options[knw] <= LUT[knw][i+1]) {
      var linearInterpolationValue = options[knw] - LUT[knw][i];
      return LUT[unk][i] + linearInterpolationValue;
    }
  }
}
let selected
function handleUp(pos, canvas) {
  if (gState == Mode.kDragging) {
    canvas.removeEventListener("mousemove", updateSelected, false);
    gBezierPath.clearSelected();
    gState = Mode.kSelecting;
  } else {
    if (!gBezierPath)
      return false;
    selected = gBezierPath.selectPoint(pos);

    if (selected) {
      gState = Mode.kDragging;
      canvas.addEventListener("mousemove", updateSelected, false);
    }
  }
}

function findYatX(x, context, prev) {
  let y = prev || (mainCurvePoints[0][1] - 10);
  let t = 1;

  let v = context.getImageData(x, y, 1, 1).data[2];

  while (v !== 139) {
    if (prev) {
      if (t % 2) {
        y = y - t;
      } else {
        y = y + t;
      }

      if (y < 0) {
        break;
      }

      t++;
    } else {
      y = y + 1;
    }

    if (y > mainCurvePoints[mainCurvePoints.length - 1][1] + 800) {
      return prev || (mainCurvePoints[0][1] - 10);
    }

    v = context.getImageData(x, y, 1, 1).data[2];
  }

  console.log('x', x, 'y', y);
  return y;
}


function updateSelected(e) {
  gBezierPath.updateSelected(new Point([e.pageX, e.pageY]));
  upd();
}

///////////////////////////////////////////////////////////////////////////////
// Classes
///////////////////////////////////////////////////////////////////////////////
function Point(coord)
{
  var my = this;
  var xVal = coord[0];
  var yVal = coord[1];
  var angle = coord.angle;

  var RADIUS = 5;
  var SELECT_RADIUS = RADIUS + 2;

  this.angle = function() {
    return angle;
  }

  this.x = function () {
    return xVal;
  }

  this.y = function () {
    return yVal;
  }

  this.set = function(x, y) {
    xVal = x;
    yVal = y;
  };

  this.drawSquare = function(ctx) {
    ctx.fillRect(xVal - RADIUS, yVal - RADIUS, RADIUS * 2, RADIUS * 2);

    ctx.font = "10px Arial";
    ctx
      .fillText(`${ (xVal - config.canvasStartingPoint[0]).toFixed(0) } ${ (yVal - mainCurvePoints[0][1]).toFixed(0) }`, xVal + 5, yVal - 5);
  };

  this.computeSlope = function(pt) {
    return (pt.y() - yVal) / (pt.x() - xVal);
  };

  this.contains = function(pt) {
    var xInRange = pt.x() >= xVal - SELECT_RADIUS && pt.x() <= xVal + SELECT_RADIUS;
    var yInRange = pt.y() >= yVal - SELECT_RADIUS && pt.y() <= yVal + SELECT_RADIUS;
    return xInRange && yInRange;
  };

  this.offsetFrom = function(pt) {
    return {
      xDelta : pt.x() - xVal,
      yDelta : pt.y() - yVal,
    };
  };

  this.translate = function(xDelta, yDelta) {
    xVal += xDelta;
    yVal += yDelta;
  };
}

function ControlPoint(angle, magnitude, owner, isFirst, index) {
  var my = this;

  var _angle = angle;
  var _magnitude = magnitude;
  var _index = index;

  // Pointer to the line segment to which this belongs.
  var _owner = owner;
  var _isFirst = isFirst;

  this.setAngle = function(deg) {
    // don't update neighbor in risk of infinite loop!
    // TODO fixme fragile
    if (_angle != deg)
      _angle = deg;
  }

  this.origin = function origin() {
    var line = null;



    if (_isFirst)
      line = _owner.prev;
    else
      line = _owner;
    if (line) {
      const coord = [line.pt.x(), line.pt.y()];
      // coord.angle = angle;
      return new Point(coord);
    }

    return null;
  }

  // Returns the Point at which the knob is located.
  this.asPoint = function() {
    const coord = [my.x(), my.y()];
    coord.angle = angle;
    return new Point(coord);
  };

  this.x = function () {
    return  my.origin().x() + my.xDelta();
  }

  this.y = function () {
    return my.origin().y() + my.yDelta();
  }

  this.xDelta = function() {
    return _magnitude * Math.cos(_angle);
  }

  this.yDelta = function() {
    return _magnitude * Math.sin(_angle);
  }

  function computeMagnitudeAngleFromOffset(xDelta, yDelta) {
    _magnitude = Math.sqrt(Math.pow(xDelta, 2) + Math.pow(yDelta, 2));

    mainCurvePoints[_index][`${ isFirst ? 'firstM' : 'secondM' }X`]
      = mainCurvePoints[_index + ((isFirst || _index === mainCurvePoints.length - 1) ? 0 : 1)][0] + xDelta;

    mainCurvePoints[_index][`${ isFirst ? 'firstM' : 'secondM' }Y`]
      = mainCurvePoints[_index + ((isFirst || _index === mainCurvePoints.length - 1) ? 0 : 1)][1] + yDelta;

    mainCurvePoints[_index][isFirst ? 'firstM' : 'secondM'] = _magnitude;
    var tryAngle = Math.atan(yDelta /xDelta);
    if (!isNaN(tryAngle)) {
      _angle = tryAngle;
      if (xDelta < 0)
        _angle += Math.PI;
    }

    if (isFirst) {
      mainCurvePoints[_index].angle = Math.PI + _angle;
    } else {
      if (_index !== mainCurvePoints.length - 1) {
        mainCurvePoints[_index + 1].angle = _angle;
      } else {
        mainCurvePoints[_index].angle = _angle;
      }
    }
  }

  this.translate = function(xDelta, yDelta) {
    var newLoc = my.asPoint();

    newLoc.translate(xDelta, yDelta);
    var dist = my.origin().offsetFrom(newLoc);
    computeMagnitudeAngleFromOffset(dist.xDelta, dist.yDelta);
    if (my.__proto__.syncNeighbor)
      updateNeighbor();
  };

  function updateNeighbor() {
    var neighbor = null;
    if (_isFirst && _owner.prev)
      neighbor = _owner.prev.ctrlPt2;
    else if (!_isFirst && _owner.next)
      neighbor = _owner.next.ctrlPt1;
    if (neighbor)
      neighbor.setAngle(_angle + Math.PI);
  }

  this.contains = function(pt) {
    return my.asPoint().contains(pt);
  }

  this.offsetFrom = function(pt) {
    return my.asPoint().offsetFrom(pt);
  }

  this.draw = function(ctx) {
    ctx.save();
    ctx.fillStyle = 'gray';
    ctx.strokeStyle = 'gray';
    ctx.beginPath();
    var startPt = my.origin();
    var endPt = my.asPoint();
    ctx.moveTo(startPt.x(), startPt.y());
    ctx.lineTo(endPt.x(), endPt.y());
    ctx.stroke();
    endPt.drawSquare(ctx);
    ctx.restore();
  }

  // When Constructed
  if (my.__proto__.syncNeighbor)
    updateNeighbor();
}

// Static variable dictacting if neighbors must be kept in sync.
ControlPoint.prototype.syncNeighbor = true;

function LineSegment(pt, prev) {
  var my = this;

  // Path point.
  this.pt;
  // Control point 1.
  this.ctrlPt1;
  // Control point 2.
  this.ctrlPt2;

  // Next LineSegment in path
  this.next;
  // Previous LineSegment in path
  this.prev;

  // Specific point on the LineSegment that is selected.
  this.selectedPoint;

  init();

  this.draw = function(ctx) {
    my.pt.drawSquare(ctx);
    // Draw control points if we have them
    if (my.ctrlPt1)
      my.ctrlPt1.draw(ctx);
    if (my.ctrlPt2)
      my.ctrlPt2.draw(ctx);

    // If there are at least two points, draw curve.
    if (my.prev)
      drawCurve(ctx, my.prev.pt, my.pt, my.ctrlPt1, my.ctrlPt2);
  }

  this.findInLineSegment = function(pos) {
    if (my.pathPointIntersects(pos)) {
      my.selectedPoint = my.pt;
      return true;
    } else if (my.ctrlPt1 && my.ctrlPt1.contains(pos)) {
      my.selectedPoint = my.ctrlPt1;
      return true;
    } else if (my.ctrlPt2 && my.ctrlPt2.contains(pos)) {
      my.selectedPoint = my.ctrlPt2;
      return true;
    }
    return false;
  }

  this.pathPointIntersects = function(pos) {
    return my.pt && my.pt.contains(pos);
  }

  this.moveTo = function(pos) {
    var dist = my.selectedPoint.offsetFrom(pos);
    my.selectedPoint.translate(dist.xDelta, dist.yDelta);
  };

  function drawCurve(ctx, startPt, endPt, ctrlPt1, ctrlPt2) {
    ctx.save();
    ctx.lineWidth = config.mainLineWidth;
    ctx.fillStyle = config.mainLineColor;
    ctx.strokeStyle = config.mainLineColor;
    ctx.beginPath();
    ctx.moveTo(startPt.x(), startPt.y());
    ctx.bezierCurveTo(ctrlPt1.x(), ctrlPt1.y(), ctrlPt2.x(), ctrlPt2.y(), endPt.x(), endPt.y());
    ctx.stroke();
    ctx.restore();
  }

  function init() {
    my.pt = pt;
    my.prev = prev;

    const index = mainCurvePoints.findIndex(item => item[0] === my.pt.x() && item[1] === my.pt.y());

    let ind = index - 1;

    if (index === mainCurvePoints.length - 1) {
      ind = index;
    }

    if (my.prev) {
      my.ctrlPt1 = new ControlPoint(
        mainCurvePoints[index - 1].angle + Math.PI,
        mainCurvePoints[index - 1].firstM,
        my,
        true,
        index - 1);

      my.ctrlPt2 = new ControlPoint(
        mainCurvePoints[ind].angle,
        mainCurvePoints[ind].secondM,
        my,
        false,
        ind);
    }
  };
}
var selectedSegment
function BezierPath(startPoint)
{
  var my = this;
  // Beginning of BezierPath linked list.
  this.head = null;
  // End of BezierPath linked list
  this.tail = null;
  // Reference to selected LineSegment
  // var selectedSegment;

  this.addPoint = function(pt) {
    var newPt = new LineSegment(pt, my.tail);
    if (my.tail == null) {
      my.tail = newPt;
      my.head = newPt;
    } else {
      my.tail.next = newPt;
      my.tail = my.tail.next;
    }
    return newPt;
  };

  // Must call after add point, since init uses
  // addPoint
  // TODO: this is a little gross
  init();

  this.draw = function(ctx) {
    if (my.head == null)
      return;

    var current = my.head;

    while (current != null) {
      current.draw(ctx);
      current = current.next;
    }
  };

  // returns true if point selected
  this.selectPoint = function(pos) {
    var current = my.head;

    while (current != null) {
      if (current.findInLineSegment(pos)) {
        selectedSegment = current;
        return true;
      }
      current = current.next;
    }
    return false;
  }

  this.clearSelected = function() {
    selectedSegment = null;
  }

  this.updateSelected = function(pos) {
    selectedSegment.moveTo(pos);
  }

  function init() {
    my.addPoint(startPoint);
  };
}
