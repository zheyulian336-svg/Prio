// 拖拽三态判定与处理：矩阵内的小球 + 待办清单卡片重排序。

import { pixelToCoord, isOutOfBounds, getPlaneRect, quadrantOf } from './matrix.js';

const HOLD_MS = 300;

/**
 * 处理矩阵小球的 mousedown：区分"单击"和"长按拖拽"。
 * @param {string} taskId
 * @param {HTMLElement} ballEl
 * @param {MouseEvent} downEvent
 * @param {object} task 当前任务 (含 x,y)
 * @param {{ onClick, onMove, onDropSameQuadrant, onDropOtherQuadrant, onDropOutside }} callbacks
 */
function handleBallMouseDown(taskId, ballEl, downEvent, task, callbacks) {
  downEvent.preventDefault();
  let holdTimer = null;
  let dragging = false;
  let moved = false;
  const startQuadrant = quadrantOf(task.x, task.y);

  const rect = getPlaneRect();
  const startPx = downEvent.clientX - rect.left;
  const startPy = downEvent.clientY - rect.top;

  function startDragging() {
    dragging = true;
    ballEl.classList.add('dragging');
  }

  holdTimer = setTimeout(startDragging, HOLD_MS);

  function onMouseMove(e) {
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (Math.abs(px - startPx) > 3 || Math.abs(py - startPy) > 3) {
      moved = true;
    }
    if (!dragging) return;

    ballEl.style.left = `${px}px`;
    ballEl.style.top = `${py}px`;
    callbacks.onMove(taskId, px, py);
  }

  function onMouseUp(e) {
    clearTimeout(holdTimer);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    ballEl.classList.remove('dragging');

    if (!dragging) {
      if (!moved) callbacks.onClick(taskId);
      return;
    }

    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (isOutOfBounds(px, py)) {
      // 取消删除时，store 里坐标未被修改，调用方重新渲染即可让小球弹回原位置
      callbacks.onDropOutside(taskId);
      return;
    }

    const { x, y } = pixelToCoord(px, py);
    const newQuadrant = quadrantOf(x, y);
    if (newQuadrant === startQuadrant) {
      callbacks.onDropSameQuadrant(taskId, x, y);
    } else {
      callbacks.onDropOtherQuadrant(taskId, x, y);
    }
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

/**
 * 待办卡片通过左侧手柄拖拽重排序。
 * @param {HTMLElement} handleEl 手柄元素（mousedown 触发点）
 * @param {HTMLElement} cardEl 卡片本体（会被移动）
 * @param {HTMLElement} listContainer 卡片列表容器
 * @param {{ onReorder }} callbacks onReorder(taskId, newIndex)
 * @param {string} taskId
 */
function attachCardHandleDrag(handleEl, cardEl, listContainer, taskId, callbacks) {
  handleEl.addEventListener('mousedown', (downEvent) => {
    downEvent.preventDefault();
    cardEl.classList.add('card-dragging');

    function onMouseMove(e) {
      const cards = Array.from(listContainer.querySelectorAll('.task-card:not(.card-dragging)'));
      let insertBeforeEl = null;
      for (const c of cards) {
        const box = c.getBoundingClientRect();
        const midY = box.top + box.height / 2;
        if (e.clientY < midY) {
          insertBeforeEl = c;
          break;
        }
      }
      if (insertBeforeEl) {
        listContainer.insertBefore(cardEl, insertBeforeEl);
      } else {
        listContainer.appendChild(cardEl);
      }
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      cardEl.classList.remove('card-dragging');

      const cards = Array.from(listContainer.querySelectorAll('.task-card'));
      const newIndex = cards.indexOf(cardEl);
      callbacks.onReorder(taskId, newIndex);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

export { handleBallMouseDown, attachCardHandleDrag };
