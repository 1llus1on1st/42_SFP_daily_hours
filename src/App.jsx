import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MAX_REMOTE = 42; // fixed rule
const MAX_REMOTE_PER_DAY = 10.5;

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getMondayFirstDayIndex(year, month) {
  const jsDay = new Date(year, month, 1).getDay();
  return (jsDay + 6) % 7;
}

function isWeekend(year, month, day) {
  const jsDay = new Date(year, month, day).getDay();
  return jsDay === 0 || jsDay === 6;
}

function getDateStatus(year, month, day) {
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const candidate = new Date(year, month, day).getTime();

  if (candidate < current) return "past";
  if (candidate > current) return "future";
  return "today";
}

const formatTime = (hours) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}min`;
};

export default function App() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [targetHours, setTargetHours] = useState(140);
  const [otherAttendedHours, setOtherAttendedHours] = useState(0);
  const [selectedDates, setSelectedDates] = useState({});
  const [dailyHours, setDailyHours] = useState({});
  const [lastDay, setLastDay] = useState(null);

  const daysInMonth = getDaysInMonth(year, month);
  const firstIndex = getMondayFirstDayIndex(year, month);

  const changeMonth = (direction) => {
    setMonth((currentMonth) => {
      const nextMonth = currentMonth + direction;

      if (nextMonth < 0) {
        setYear((currentYear) => currentYear - 1);
        return 11;
      }

      if (nextMonth > 11) {
        setYear((currentYear) => currentYear + 1);
        return 0;
      }

      return nextMonth;
    });
    setLastDay(null);
  };

  const resetPlanner = () => {
    const currentDate = new Date();
    setYear(currentDate.getFullYear());
    setMonth(currentDate.getMonth());
    setTargetHours(140);
    setOtherAttendedHours(0);
    setSelectedDates({});
    setDailyHours({});
    setLastDay(null);
  };

  const selectedDays = useMemo(() => {
    const arr = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (selectedDates[`${year}-${month}-${d}`]) arr.push(d);
    }
    return arr;
  }, [selectedDates, year, month, daysInMonth]);

  const inDays = selectedDays.filter(
    d => selectedDates[`${year}-${month}-${d}`] === "in"
  );

  const remoteDays = selectedDays.filter(
    d => selectedDates[`${year}-${month}-${d}`] === "remote"
  );

  const enteredSelectedHours = useMemo(
    () => Object.entries(dailyHours).reduce((total, [key, value]) => {
      if (!selectedDates[key]) return total;
      return total + (Number(value) || 0);
    }, 0),
    [dailyHours, selectedDates]
  );

  const enteredRemoteHours = useMemo(
    () => Object.entries(dailyHours).reduce((total, [key, value]) => {
      if (selectedDates[key] !== "remote") return total;
      return total + (Number(value) || 0);
    }, 0),
    [dailyHours, selectedDates]
  );

  const totalCountedHours = otherAttendedHours + enteredSelectedHours;
  const remaining = Math.max(targetHours - totalCountedHours, 0);

  const hasDailyHours = (day) => {
    const value = dailyHours[`${year}-${month}-${day}`];
    return value !== undefined && value !== "";
  };

  const inPlanningDays = inDays.filter(d => !hasDailyHours(d));
  const remotePlanningDays = remoteDays.filter(d => !hasDailyHours(d));

  const remoteHours = remotePlanningDays.length > 0
    ? Math.min(
      Math.max(MAX_REMOTE - enteredRemoteHours, 0),
      remotePlanningDays.length * MAX_REMOTE_PER_DAY,
      remaining
    )
    : 0;

  const inHours = remaining - remoteHours;

  const remotePerDay = remotePlanningDays.length ? remoteHours / remotePlanningDays.length : 0;
  const inPerDay = inPlanningDays.length ? inHours / inPlanningDays.length : 0;

  const cells = useMemo(() => {
    const arr = [];

    for (let i = 0; i < firstIndex; i++) arr.push({ empty: true });

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${month}-${d}`;
      arr.push({
        day: d,
        key,
        selected: selectedDates[key],
        weekend: isWeekend(year, month, d),
        dateStatus: getDateStatus(year, month, d),
      });
    }

    while (arr.length % 7 !== 0) arr.push({ empty: true });

    return arr;
  }, [selectedDates, year, month, daysInMonth, firstIndex]);

  const toggle = (key, day, e) => {
    const shift = e?.shiftKey;

    const nextState = (val) => {
      if (val === "in") return "remote";
      if (val === "remote") return undefined;
      return "in";
    };

    setSelectedDates(prev => {
      const newState = nextState(prev[key]);

      if (shift && lastDay !== null) {
        const start = Math.min(lastDay, day);
        const end = Math.max(lastDay, day);
        const next = { ...prev };

        for (let d = start; d <= end; d++) {
          const k = `${year}-${month}-${d}`;
          if (newState) next[k] = newState;
          else delete next[k];
        }

        if (!newState) {
          setDailyHours((hours) => {
            const nextHours = { ...hours };
            for (let d = start; d <= end; d++) {
              delete nextHours[`${year}-${month}-${d}`];
            }
            return nextHours;
          });
        }

        return next;
      }

      const next = { ...prev };
      if (newState) {
        next[key] = newState;
      } else {
        delete next[key];
        setDailyHours((hours) => {
          const nextHours = { ...hours };
          delete nextHours[key];
          return nextHours;
        });
      }

      return next;
    });

    setLastDay(day);
  };

  const updateDailyHours = (key, value) => {
    setDailyHours((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-6">

        <h1 className="text-3xl font-semibold">Attendance Planner</h1>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={resetPlanner}
            className="rounded border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            Reset
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
            title="Previous month"
            className="inline-flex h-10 w-10 items-center justify-center rounded border bg-white hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>

          <div className="text-xl font-medium" aria-live="polite">
            {MONTHS[month]} {year}
          </div>

          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="Next month"
            title="Next month"
            className="inline-flex h-10 w-10 items-center justify-center rounded border bg-white hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-gray-700">
              Required hours
            </span>
            <input
              className="w-full rounded border p-2"
              type="number"
              value={targetHours}
              onChange={e => setTargetHours(+e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-gray-700">
              Other attended hours
            </span>
            <input
              className="w-full rounded border p-2"
              type="number"
              value={otherAttendedHours}
              onChange={e => setOtherAttendedHours(+e.target.value)}
            />
          </label>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map(d => <div key={d}>{d}</div>)}

          {cells.map((c, i) => {
            if (c.empty) return <div key={i}></div>;

            return (
              <div
                key={c.key}
                className={`
                  min-h-20 rounded border bg-white p-1
                  ${c.selected === "in"
                    ? "border-black"
                    : c.selected === "remote"
                    ? "border-blue-500"
                    : c.dateStatus === "today"
                    ? "border-amber-400 bg-amber-50"
                    : c.dateStatus === "past"
                    ? "border-gray-200 bg-gray-100"
                    : "border-gray-200 bg-white"}
                `}
              >
                <button
                  type="button"
                  onClick={(e) => toggle(c.key, c.day, e)}
                  className={`
                    flex h-8 w-full items-center justify-center rounded text-sm font-medium
                    ${c.selected === "in"
                      ? "bg-black text-white"
                      : c.selected === "remote"
                      ? "bg-blue-500 text-white"
                      : c.dateStatus === "today"
                      ? "bg-amber-200 text-amber-950 hover:bg-amber-300"
                      : c.dateStatus === "past"
                      ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      : "bg-white text-gray-900 hover:bg-gray-100"}
                  `}
                >
                  {c.day}
                </button>

                {c.selected && (
                  <label className="mt-1 block">
                    <span className="sr-only">
                      Hours present on {MONTHS[month]} {c.day}, {year}
                    </span>
                    <input
                      className="h-8 w-full rounded border border-gray-200 px-1 text-center text-sm text-gray-900"
                      type="number"
                      min="0"
                      step="0.25"
                      inputMode="decimal"
                      placeholder="hrs"
                      value={dailyHours[c.key] ?? ""}
                      onChange={(e) => updateDailyHours(c.key, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-white p-4 border rounded space-y-2">
          <div>Entered on selected days: {formatTime(enteredSelectedHours)}</div>

          <div>Total counted hours: {formatTime(totalCountedHours)}</div>

          <div>Remaining: {remaining}h</div>

          <div>
            In-person days without manual hours: {inPlanningDays.length} → {formatTime(inPerDay)} / day
          </div>

          <div>
            Remote days without manual hours: {remotePlanningDays.length} → {formatTime(remotePerDay)} / day
          </div>
        </div>

      </div>
    </div>
  );
}
