/*
Copylight 2015 NOBUOKA Yu
*/

declare var WinJS: any;

module VC.UI.Calendar {
    "use strict";

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
                var e = document.createElement("span");
                e.style.position = "absolute";
                e.style.top = (60 * row) + "px";
                e.style.left = (30 * col) + "px";
                e.textContent = String(d);
                f.appendChild(e);

                col++;
                if (7 <= col) {
                    col = 0;
                    row++;
                }
            }

            this.heightForNextMonth = 60 * row;
            this.fullHeight = this.heightForNextMonth + (col !== 0 ? 60 : 0);
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
                // dispatch event;
            }
            // Update DOM.
            this.element.style.top = this._top + "px";
        }
        private _monthes: MonthView[];
        currentMonthView: MonthView;

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
            this.currentMonthView = monthView;
            this.currentMonthView.element.classList.add("vc-active");
            this.pushMonthView(monthView);
            this._addOrRemoveMonthesIfNecessary();
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
            this.element.style.width = "210px";
            this.element.style.height = height + "px";
            this.element.style.border = "solid 1px black";
            this.element.style.backgroundColor = "rgba(100, 100, 100, 0.5)";
            this.element.style.overflow = "hidden";
            this.element.style.position = "relative";
            this.element.addEventListener("mousewheel", (evt) => {
                var delta = Math.max(-1, Math.min(1,(evt.wheelDelta || -evt.detail)));
                console.log(delta);
                this._updateScrollableViewPosition(delta * 30);
            }, false);

            this._scrollableViewManager = new ScrollableViewManager(height);
            this.element.appendChild(this._scrollableViewManager.element);

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
