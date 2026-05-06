import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MAX_REMOTE = 42; // fixed rule
const MAX_REMOTE_PER_DAY = 10.5;
const MAX_IN_PERSON_PER_DAY = 24;

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

  const inHours = Math.min(
    Math.max(remaining - remoteHours, 0),
    inPlanningDays.length * MAX_IN_PERSON_PER_DAY
  );
  const unallocatedHours = Math.max(remaining - remoteHours - inHours, 0);

  const remotePerDay = remotePlanningDays.length ? remoteHours / remotePlanningDays.length : 0;
  const inPerDay = inPlanningDays.length ? inHours / inPlanningDays.length : 0;
  const progress = targetHours > 0
    ? Math.min((totalCountedHours / targetHours) * 100, 100)
    : 0;

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
    const cappedValue = selectedDates[key] === "in" && value !== ""
      ? Math.min(Math.max(Number(value) || 0, 0), MAX_IN_PERSON_PER_DAY)
      : value;

    setDailyHours((prev) => ({
      ...prev,
      [key]: cappedValue,
    }));
  };

  return (
    <main className="min-h-screen bg-[#F6F7FB] px-4 py-8 text-[#111827] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#6B7280]">School attendance</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-[#111827]">
              Attendance Planner
            </h1>
          </div>

          <button
            type="button"
            onClick={resetPlanner}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-4 text-sm font-medium text-[#374151] shadow-sm transition hover:border-[#CBD5E1] hover:bg-[#F9FAFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
          >
            Reset planner
          </button>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6B7280]">Required</p>
            <p className="mt-2 text-2xl font-semibold text-[#111827]">{formatTime(targetHours)}</p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6B7280]">Counted</p>
            <p className="mt-2 text-2xl font-semibold text-[#16A34A]">{formatTime(totalCountedHours)}</p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6B7280]">Remaining</p>
            <p className="mt-2 text-2xl font-semibold text-[#2563EB]">{formatTime(remaining)}</p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6B7280]">Needs days</p>
            <p className="mt-2 text-2xl font-semibold text-[#F59E0B]">{formatTime(unallocatedHours)}</p>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            <div className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#111827]">Planning inputs</h2>
                  <p className="mt-1 text-sm text-[#6B7280]">Set the target and any hours not entered on calendar days.</p>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB] sm:w-48">
                  <div
                    className="h-full rounded-full bg-[#2563EB]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="block text-sm font-medium text-[#374151]">
                    Required hours
                  </span>
                  <input
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 text-[#111827] shadow-sm outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
                    type="number"
                    value={targetHours}
                    onChange={e => setTargetHours(+e.target.value)}
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-sm font-medium text-[#374151]">
                    Other attended hours
                  </span>
                  <input
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 text-[#111827] shadow-sm outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
                    type="number"
                    value={otherAttendedHours}
                    onChange={e => setOtherAttendedHours(+e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  aria-label="Previous month"
                  title="Previous month"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] text-[#374151] shadow-sm transition hover:bg-[#F9FAFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                >
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>

                <div className="text-center" aria-live="polite">
                  <p className="text-xl font-semibold text-[#111827]">{MONTHS[month]} {year}</p>
                  <p className="mt-1 text-sm text-[#6B7280]">Click a day to cycle in-person, remote, off.</p>
                </div>

                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  aria-label="Next month"
                  title="Next month"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] text-[#374151] shadow-sm transition hover:bg-[#F9FAFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                >
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {WEEKDAYS.map(d => (
                  <div
                    key={d}
                    className="pb-2 text-center text-xs font-semibold uppercase text-[#6B7280]"
                  >
                    {d}
                  </div>
                ))}

                {cells.map((c, i) => {
                  if (c.empty) return <div key={i} className="h-32 rounded-xl"></div>;

                  const completed = hasDailyHours(c.day);
                  const statusLabel = completed
                    ? "Completed"
                    : c.selected === "in"
                    ? "In person"
                    : c.selected === "remote"
                    ? "Remote"
                    : c.dateStatus === "today"
                    ? "Today"
                    : c.dateStatus === "past"
                    ? "Inactive"
                    : "Available";
                  const cardState = completed
                    ? "border-transparent bg-green-50 shadow-md shadow-green-100/70 ring-1 ring-green-100"
                    : c.selected
                    ? "border-transparent bg-blue-50 shadow-md shadow-blue-100/80 ring-1 ring-blue-100"
                    : c.dateStatus === "today"
                    ? "border-transparent bg-amber-50 ring-1 ring-amber-100"
                    : c.dateStatus === "past"
                    ? "border-transparent bg-[#F3F4F6] text-[#6B7280] ring-1 ring-[#E5E7EB]"
                    : "border-transparent bg-[#FFFFFF] ring-1 ring-[#E5E7EB]";
                  const badgeState = completed
                    ? "bg-[#16A34A] text-white"
                    : c.selected
                    ? "bg-[#2563EB] text-white"
                    : c.dateStatus === "today"
                    ? "bg-amber-100 text-[#92400E]"
                    : c.dateStatus === "past"
                    ? "bg-[#E5E7EB] text-[#6B7280]"
                    : "bg-[#F9FAFB] text-[#374151]";
                  const statusState = completed
                    ? "text-[#15803D]"
                    : c.selected === "in"
                    ? "text-[#047857]"
                    : c.selected === "remote"
                    ? "text-[#2563EB]"
                    : c.dateStatus === "today"
                    ? "text-[#B45309]"
                    : c.dateStatus === "past"
                    ? "text-[#6B7280]"
                    : "text-[#6B7280]";

                  return (
                    <div
                      key={c.key}
                      role="button"
                      tabIndex={0}
                      aria-pressed={Boolean(c.selected)}
                      onClick={(e) => toggle(c.key, c.day, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle(c.key, c.day, e);
                        }
                      }}
                      className={`h-32 rounded-xl border p-3 outline-none transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#F8FAFC] hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${cardState}`}
                    >
                      <div className="flex h-full flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold ${badgeState}`}>
                            {c.day}
                          </span>
                          {c.dateStatus === "today" && (
                            <span className="h-2 w-2 rounded-full bg-[#F59E0B]" aria-label="Today" />
                          )}
                        </div>

                        {c.selected ? (
                          <label className="block">
                            <span className="sr-only">
                              Hours present on {MONTHS[month]} {c.day}, {year}
                            </span>
                            <input
                              className="h-9 w-full rounded-lg border border-transparent bg-white/90 px-2 text-center text-sm font-semibold text-[#111827] shadow-sm outline-none transition placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-blue-200"
                              type="number"
                              min="0"
                              max={c.selected === "in" ? MAX_IN_PERSON_PER_DAY : undefined}
                              step="0.25"
                              inputMode="decimal"
                              placeholder="hrs"
                              value={dailyHours[c.key] ?? ""}
                              onChange={(e) => updateDailyHours(c.key, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </label>
                        ) : (
                          <div className="flex h-9 items-center justify-center rounded-lg bg-white/55 text-xs font-medium text-[#9CA3AF]">
                            hrs
                          </div>
                        )}

                        <div className={`mt-auto truncate text-center text-xs font-semibold ${statusState}`}>
                          {statusLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="space-y-8">
            <div className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#111827]">Summary</h2>
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-4 border-b border-[#E5E7EB] pb-4">
                  <span className="text-sm text-[#6B7280]">Entered on selected days</span>
                  <span className="text-sm font-semibold text-[#111827]">{formatTime(enteredSelectedHours)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-[#E5E7EB] pb-4">
                  <span className="text-sm text-[#6B7280]">Total counted hours</span>
                  <span className="text-sm font-semibold text-[#16A34A]">{formatTime(totalCountedHours)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-[#E5E7EB] pb-4">
                  <span className="text-sm text-[#6B7280]">Remaining</span>
                  <span className="text-sm font-semibold text-[#2563EB]">{formatTime(remaining)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-[#6B7280]">Still needs days allocated</span>
                  <span className="text-sm font-semibold text-[#F59E0B]">{formatTime(unallocatedHours)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#111827]">Daily plan</h2>
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                  <p className="text-sm font-medium text-[#374151]">In-person days without manual hours</p>
                  <p className="mt-2 text-2xl font-semibold text-[#111827]">{inPlanningDays.length}</p>
                  <p className="mt-1 text-sm text-[#6B7280]">{formatTime(inPerDay)} / day</p>
                </div>

                <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                  <p className="text-sm font-medium text-[#374151]">Remote days without manual hours</p>
                  <p className="mt-2 text-2xl font-semibold text-[#111827]">{remotePlanningDays.length}</p>
                  <p className="mt-1 text-sm text-[#6B7280]">{formatTime(remotePerDay)} / day</p>
                </div>
              </div>
            </div>
          </aside>
        </section>

      </div>
    </main>
  );
}
