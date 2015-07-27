/*
Copylight 2015 NOBUOKA Yu
*/

declare var Windows: any;
declare var WinJS: any;

module VC.UI.Calendar {
    "use strict";

    interface PointLogItem {
        position: number;
        time: number;
    }

    class VelocityTracker {
        pointLog: PointLogItem[] = [];

        addPoint(logItem: PointLogItem) {
            this.pointLog.push(logItem);
        }

        calcVelocity(): number {
            if (this.pointLog.length < 2) return 0;

            var reversed = this.pointLog.reverse();
            var lastTime = reversed[0].time;
            var deltaT: number;
            var deltaPos: number;
            for (var i = 1; i < reversed.length; i++) {
                if (lastTime - reversed[i].time < 100) {
                    deltaT = lastTime - reversed[i].time;
                    deltaPos = reversed[0].position - reversed[i].position;
                } else {
                    break;
                }
            }
            if (deltaPos) {
                return deltaPos / deltaT;
            } else {
                return 0;
            }
        }
    }

    class PointerPanManager {

        private _targetElem: HTMLElement;
        private _targetScrollableView: ScrollableViewManager;

        private _lastUpdate: number;
        private _lastSpeed: number; // [px / ms]

        private _animationRequestId: number = undefined;

        constructor(targetElem: HTMLElement, targetScrollableView: ScrollableViewManager) {
            this._targetElem = targetElem;
            this._targetScrollableView = targetScrollableView;
        }

        private _animate = () => {
            if (typeof this._lastSpeed !== "number") {
                return; // Do nothing.
            }

            var t = Date.now();
            var deltaT = t - this._lastUpdate;
            var deltaY = this._lastSpeed * deltaT;
            this._targetScrollableView.top += deltaY;

            var sign = this._lastSpeed > 0;
            var speed = this._lastSpeed + (sign ? -1 : 1) * 0.03125;
            if ((speed > 0) === sign) {
                this._lastSpeed = speed;
                this._lastUpdate = t;
                this._animationRequestId = requestAnimationFrame(this._animate);
            }
        };

        startHandlingPanGesture(): void {
            this._targetElem.addEventListener("pointerdown",(evt) => {
                if (this._animationRequestId !== undefined) {
                    cancelAnimationFrame(this._animationRequestId);
                    this._animationRequestId = undefined;
                }

                var tracker = new VelocityTracker();

                var initialY = evt.screenY;
                var prevY = initialY;
                var prevTime = Date.now();
                tracker.addPoint({
                    position: initialY,
                    time: Date.now(),
                });
                var onPointerMove = (evt: PointerEvent) => {
                    console.log("move");
                    var y = evt.screenY;
                    var t = Date.now();
                    tracker.addPoint({ position: y, time: t });
                    var deltaY = y - prevY;
                    var deltaT = t - prevTime;
                    this._targetScrollableView.top += deltaY;
                    prevY = y;
                    prevTime = t;
                };
                var onPointerUp = (evt: PointerEvent) => {
                    window.removeEventListener("pointermove", onPointerMove);
                    window.removeEventListener("pointerup", onPointerUp);

                    var y = evt.screenY;
                    var t = Date.now();
                    tracker.addPoint({ position: y, time: t });
                    this._lastSpeed = tracker.calcVelocity();
                    this._lastUpdate = prevTime;
                    requestAnimationFrame(this._animate);
                };
                window.addEventListener("pointermove", onPointerMove);
                window.addEventListener("pointerup", onPointerUp);
            });
        }

    }

    interface Month {
        year: number;
        month: number;
    }

    function createPrevMonth(month: Month): Month {
        var y = month.year;
        var m = month.month - 1;
        if (m < 1) {
            m = 12;
            y -= 1;
        }
        return {
            year: y,
            month: m,
        };
    }

    function createNextMonth(month: Month): Month {
        var y = month.year;
        var m = month.month + 1;
        if (12 < m) {
            m = 1;
            y += 1;
        }
        return {
            year: y,
            month: m,
        };
    }

    function createDate(month: Month): Date {
        return new Date(month.year, month.month - 1);
    }

    class MonthViewPool {
    }

    class MonthView {
        month: Month;
        top: number;
        heightForNextMonth: number;
        fullHeight: number;
        element: HTMLElement;

        private _cellHeight = 48;
        private _cellWidth = 48;

        constructor(m: Month) {
            var elem = document.createElement("div");
            elem.style.position = "relative";
            elem.classList.add("vc-month");

            this.element = elem;
            this.month = m;
            this.top = 0;

            this._setupDayElements();
            elem.style.height = this.heightForNextMonth + "px";
            elem.style.overflow = "visible";
            this.fullHeight = this.heightForNextMonth;
        }

        private _setupDayElements(): void {
            var f = document.createDocumentFragment();

            var nextMonthDate = createDate(createNextMonth(this.month));
            var lastDate = new Date(nextMonthDate.getTime() - 1).getDate();
            var firstDay = createDate(this.month).getDay();

            var row = 0;
            var col = firstDay;
            for (var d = 1; d <= lastDate; d++) {
                var e = document.createElement("div");
                e.style.position = "absolute";
                e.classList.add("vc-day-container");
                e.style.top = (this._cellHeight * row) + "px";
                e.style.left = (this._cellWidth * col) + "px";
                e.style.width = this._cellWidth + "px";
                e.style.height = this._cellHeight + "px";
                var e2 = document.createElement("span");
                e2.classList.add("vc-day");
                e2.textContent = String(d);

                e.appendChild(e2);
                f.appendChild(e);

                col++;
                if (7 <= col) {
                    col = 0;
                    row++;
                }
            }

            this.heightForNextMonth = this._cellHeight * row;
            this.fullHeight = this.heightForNextMonth + (col !== 0 ? this._cellHeight : 0);
            this.element.appendChild(f);
        }
    }

    class ScrollableViewManager {
        element: HTMLDivElement;
        private _height: number;
        private _visibleHeight: number;
        private _top: number;
        get top(): number {
            return this._top;
        }
        set top(val: number) {
            this._top = val;
            this._addOrRemoveMonthesIfNecessary();
            var currentMonthView = this._monthes.reduce((p, c) => {
                var pv = Math.abs(this._visibleHeight / 2 - (this._top + p.top + p.fullHeight / 2));
                var cv = Math.abs(this._visibleHeight / 2 - (this._top + c.top + c.fullHeight / 2));
                return pv < cv ? p : c;
            });
            if (currentMonthView !== this.currentMonthView) {
                this.currentMonthView.element.classList.remove("vc-active");
                this.currentMonthView = currentMonthView;
                this.currentMonthView.element.classList.add("vc-active");
                if (this._onCurrentMonthViewChangeListner) {
                    this._onCurrentMonthViewChangeListner(this);
                }
            }
            // Update DOM.
            this.element.style.top = this._top + "px";
        }
        private _monthes: MonthView[];
        currentMonthView: MonthView;

        private _onCurrentMonthViewChangeListner: (target: ScrollableViewManager) => void;

        setOnCurrentMonthViewChangeListner(listener: (target: ScrollableViewManager) => void): void {
            this._onCurrentMonthViewChangeListner = listener;
        }

        constructor(visibleHeight: number) {
            this.element = document.createElement("div");
            this._height = 0;
            this._visibleHeight = visibleHeight;
            this._top = 0;
            this._monthes = [];

            this.element.style.position = "absolute";
        }

        getScrollPosition(): number {
            return this._top;
        }

        setScrollPosition(pos: number): void {
            this._top = pos;
        }

        initialize(month: Month): void {
            var monthView = new MonthView(month);
            this.pushMonthView(monthView);
            this._addOrRemoveMonthesIfNecessary();

            this.currentMonthView = monthView;
            this.currentMonthView.element.classList.add("vc-active");
            if (this._onCurrentMonthViewChangeListner) {
                this._onCurrentMonthViewChangeListner(this);
            }
        }

        unshiftMonthView(addedMonthView: MonthView): void {
            addedMonthView.top = 0;
            this._monthes.forEach((mvi) => {
                mvi.top += addedMonthView.heightForNextMonth;
            });
            this._monthes.unshift(addedMonthView);
            this._top -= addedMonthView.heightForNextMonth;
            this._height += addedMonthView.heightForNextMonth;
            // Update DOM.
            this.element.insertBefore(addedMonthView.element, this.element.firstElementChild);
            this.element.style.top = this._top + "px";
        }

        pushMonthView(monthView: MonthView): void {
            monthView.top = this._height;
            this._monthes.push(monthView);
            this._height += monthView.heightForNextMonth;
            // Update DOM.
            this.element.appendChild(monthView.element);
        }

        shiftMonthView(): MonthView {
            var removed = this._monthes.shift();

            this._monthes.forEach((mvi) => {
                mvi.top -= removed.heightForNextMonth;
            });
            this._top += removed.heightForNextMonth;
            this._height -= removed.heightForNextMonth;
            // Update DOM.
            this.element.removeChild(removed.element);
            this.element.style.top = this._top + "px";

            return removed;
        }

        popMonthView(): MonthView {
            var removed = this._monthes.pop();

            this._height -= removed.heightForNextMonth;
            // Update DOM.
            this.element.removeChild(removed.element);

            return removed;
        }

        getFirstMonthView(): MonthView {
            return this._monthes[0];
        }

        getLastMonthView(): MonthView {
            return this._monthes[this._monthes.length - 1];
        }

        /**
         * Get the top position of the n-th `MonthView` on the coordinates system relative to the scroll window.
         * The origin is left-top of the scroll window.
         */
        getNthMonthViewTopPosition(index: number): number {
            return this._top + this._monthes[index].top;
        }

        /**
         * Get the top position of the n-th `MonthView` from the last on the coordinates system relative to the scroll window.
         * The origin is left-top of the scroll window.
         */
        getNthMonthViewTopPositionFromTheLast(index: number): number {
            var mm = this._monthes;
            return this._top + mm[mm.length - index - 1].top;
        }

        _addOrRemoveMonthesIfNecessary() {
            // If there is no invisible month on the top, the `MonthView` is added.
            while (this._monthes.length < 2 || 0 <= this.getNthMonthViewTopPosition(1)) {
                var firstMonthView = this.getFirstMonthView();
                var month = createPrevMonth(firstMonthView.month);
                var addedMonthView = new MonthView(month);
                this.unshiftMonthView(addedMonthView);
            }
            // If there are two or more invisible monthes on the top, these are removed.
            while (this._monthes.length > 3 && 0 > this.getNthMonthViewTopPosition(2)) {
                var removed = this.shiftMonthView();
            }
            // If there is no invisible month on the bottom, the `MonthView` is added.
            while (this._monthes.length < 2 || this.getNthMonthViewTopPositionFromTheLast(0) < this._visibleHeight) {
                var lastMonth = this.getLastMonthView();
                var month = createNextMonth(lastMonth.month);
                var addedMonthView = new MonthView(month);
                this.pushMonthView(addedMonthView);
            }
            // If there are two or more invisible monthes on the bottom, these are removed.
            while (this._monthes.length > 3 && this.getNthMonthViewTopPositionFromTheLast(1) >= this._visibleHeight) {
                var removed = this.popMonthView();
            }
        }
    }

    export class CalendarView {

        element: HTMLElement;
        private _scrollableViewManager: ScrollableViewManager;
        private _currentMonth: Month;

        constructor(elem: HTMLElement) {
            var height = 300;
            this.element = elem || document.createElement("div");
            this.element.style.width = "350px";
            this.element.style.border = "solid 1px black";
            this.element.style.backgroundColor = "rgba(100, 100, 100, 0.5)";

            var titleElem = document.createElement("div");
            titleElem.classList.add("vc-calendar-month-year");
            this.element.appendChild(titleElem);

            var scrollWindowElem = document.createElement("div");
            scrollWindowElem.style.height = height + "px";
            scrollWindowElem.style.overflow = "hidden";
            scrollWindowElem.style.position = "relative";
            this.element.addEventListener("mousewheel", (evt) => {
                var delta = Math.max(-1, Math.min(1,(evt.wheelDelta || -evt.detail)));
                console.log(delta);
                this._updateScrollableViewPosition(delta * 30);
            }, false);
            this._scrollableViewManager = new ScrollableViewManager(height);
            var pointerPanManager = new PointerPanManager(scrollWindowElem, this._scrollableViewManager);
            pointerPanManager.startHandlingPanGesture();
            this.element.appendChild(scrollWindowElem);
            scrollWindowElem.appendChild(this._scrollableViewManager.element);

            var dateTimeFormatter = new Windows.Globalization.DateTimeFormatting.DateTimeFormatter("month year");
            this._scrollableViewManager.setOnCurrentMonthViewChangeListner((target) => {
                var m = target.currentMonthView.month;
                var date = new Date(m.year, m.month);
                titleElem.textContent = dateTimeFormatter.format(date);
            });

            this._currentMonth = { year: 2015, month: 7 };

            this._scrollableViewManager.initialize(this._currentMonth);
        }

        private _updateScrollableViewPosition(delta: number) {
            this._scrollableViewManager.top += delta;
        }

    }
    if (typeof WinJS !== "undefined") {
        WinJS.Utilities.markSupportedForProcessing(CalendarView);
    }

}
