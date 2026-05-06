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
  const progressRounded = Math.round(progress);
  const targetReached = targetHours > 0 && totalCountedHours >= targetHours;

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
    <main className="min-h-screen bg-[#F6F7FB] px-4 py-8 text-base leading-relaxed text-[#111827] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">

        <header className="min-w-0 rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="text-[13px] font-medium uppercase leading-5 tracking-normal text-[#64748B]">
                School attendance
              </p>
              <h1 className="mt-2 text-[40px] font-bold leading-[48px] tracking-normal text-[#0F172A]">
                Attendance Planner
              </h1>
              <p className="mt-3 text-base font-normal leading-7 text-[#475569]">
                {MONTHS[month]} is {progressRounded}% complete toward your attendance target.
              </p>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-4">
              <div
                className="grid h-24 w-24 place-items-center rounded-full shadow-sm transition duration-200 ease-out"
                style={{
                  background: `conic-gradient(#2563EB ${progress}%, #E2E8F0 0)`,
                }}
                aria-label={`${progressRounded}% complete`}
              >
                <div className="grid h-20 w-20 place-items-center rounded-full bg-white">
                  <span className="text-lg font-semibold leading-6 text-[#0F172A]">{progressRounded}%</span>
                </div>
              </div>

              <button
                type="button"
                onClick={resetPlanner}
                className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-[13px] font-medium leading-5 text-[#64748B] transition duration-200 ease-out hover:bg-[#F1F5F9] hover:text-[#0F172A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <label className="min-w-0 rounded-lg bg-[#F8FAFC] p-4 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
              <span className="block text-[13px] font-medium leading-5 text-[#64748B]">
                Required Hours
              </span>
              <input
                className="app-input mt-3"
                type="number"
                value={targetHours}
                onChange={e => setTargetHours(+e.target.value)}
              />
            </label>

            <label className="min-w-0 rounded-lg bg-[#F8FAFC] p-4 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
              <span className="block text-[13px] font-medium leading-5 text-[#64748B]">
                Attended Hours
              </span>
              <input
                className="app-input mt-3"
                type="number"
                value={otherAttendedHours}
                onChange={e => setOtherAttendedHours(+e.target.value)}
              />
            </label>

            <div className="min-w-0 rounded-lg bg-blue-50 p-4 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-[13px] font-medium leading-5 text-[#2563EB]">Remaining</p>
              <p className="mt-3 text-[28px] font-semibold leading-9 tracking-normal text-[#0F172A]">
                {formatTime(remaining)}
              </p>
            </div>
          </div>

          {targetReached && (
            <div className="success-sheen relative mt-6 rounded-lg bg-green-50 p-4 text-sm font-medium leading-6 text-[#15803D] shadow-sm ring-1 ring-green-100">
              Target reached. Your month is fully covered.
            </div>
          )}
        </header>

        <section className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            <div className="min-w-0 rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] p-4 shadow-sm md:p-6">
              <div className="mb-6 flex min-w-0 items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  aria-label="Previous month"
                  title="Previous month"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#F8FAFC] text-[#475569] shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white hover:text-[#0F172A] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                >
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>

                <div className="min-w-0 text-center" aria-live="polite">
                  <h2 className="text-[28px] font-semibold leading-9 tracking-normal text-[#0F172A]">
                    {MONTHS[month]} {year}
                  </h2>
                  <p className="mt-1 text-[13px] font-medium leading-5 text-[#64748B]">Click a day to cycle in-person, remote, off.</p>
                </div>

                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  aria-label="Next month"
                  title="Next month"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#F8FAFC] text-[#475569] shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white hover:text-[#0F172A] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                >
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </div>

              <div className="grid min-w-0 grid-cols-7 gap-1 md:gap-2">
                {WEEKDAYS.map(d => (
                  <div
                    key={d}
                    className="min-w-0 pb-2 text-center text-[12px] font-medium uppercase leading-5 text-[#64748B] md:text-[13px]"
                  >
                    {d}
                  </div>
                ))}

                {cells.map((c, i) => {
                  if (c.empty) return <div key={i} className="min-h-36 min-w-0 rounded-lg md:min-h-40"></div>;

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
                    : c.selected === "in"
                    ? "bg-[#334155] text-white"
                    : c.selected === "remote"
                    ? "bg-[#2563EB] text-white"
                    : c.dateStatus === "today"
                    ? "border border-[#F59E0B] bg-white text-[#B45309]"
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
                      className={`flex min-h-36 min-w-0 flex-col items-stretch justify-between gap-2 rounded-lg border p-3 pb-4 outline-none transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 md:min-h-40 md:p-4 md:pb-4 ${c.selected ? "scale-[1.01]" : ""} ${cardState}`}
                    >
                      <div className="flex min-w-0 flex-1 flex-col items-stretch justify-between gap-2">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-medium leading-5 ${badgeState}`}>
                            {c.day}
                          </span>
                          {c.dateStatus === "today" && (
                            <span className="h-2 w-2 rounded-full bg-[#F59E0B]" aria-label="Today" />
                          )}
                        </div>

                        {c.selected ? (
                          <label className="block min-w-0 shrink-0">
                            <span className="sr-only">
                              Hours present on {MONTHS[month]} {c.day}, {year}
                            </span>
                            <input
                              className="calendar-input"
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
                          <div className="flex min-h-10 min-w-0 shrink-0 items-center justify-center rounded-lg bg-white/55 px-2 text-[12px] font-medium leading-5 text-[#94A3B8] md:text-[13px]">
                            hrs
                          </div>
                        )}

                        <div className={`min-w-0 px-3 text-center text-[12px] font-medium leading-4 md:text-[13px] md:leading-5 ${statusState}`}>
                          {statusLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="min-w-0 space-y-8">
            <div className="min-w-0 rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] p-6 shadow-sm">
              <h2 className="text-[28px] font-semibold leading-9 tracking-normal text-[#0F172A]">Summary</h2>
              <div className="mt-6 space-y-4">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] pb-4">
                  <span className="min-w-0 text-[13px] font-medium leading-5 text-[#64748B]">Entered on selected days</span>
                  <span className="min-w-0 text-base font-medium leading-6 text-[#0F172A]">{formatTime(enteredSelectedHours)}</span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] pb-4">
                  <span className="min-w-0 text-[13px] font-medium leading-5 text-[#64748B]">Total counted hours</span>
                  <span className="min-w-0 text-base font-medium leading-6 text-[#16A34A]">{formatTime(totalCountedHours)}</span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] pb-4">
                  <span className="min-w-0 text-[13px] font-medium leading-5 text-[#64748B]">Remaining</span>
                  <span className="min-w-0 text-base font-medium leading-6 text-[#2563EB]">{formatTime(remaining)}</span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 text-[13px] font-medium leading-5 text-[#64748B]">Still needs days allocated</span>
                  <span className="min-w-0 text-base font-medium leading-6 text-[#F59E0B]">{formatTime(unallocatedHours)}</span>
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] p-6 shadow-sm">
              <h2 className="text-[28px] font-semibold leading-9 tracking-normal text-[#0F172A]">Daily plan</h2>
              <div className="mt-6 space-y-4">
                <div className="min-w-0 rounded-lg bg-[#F8FAFC] p-4 shadow-sm">
                  <p className="min-w-0 text-[13px] font-medium leading-5 text-[#475569]">In-person days without manual hours</p>
                  <p className="mt-2 text-[28px] font-semibold leading-9 text-[#0F172A]">{inPlanningDays.length}</p>
                  <p className="mt-1 min-w-0 text-[13px] font-medium leading-5 text-[#64748B]">{formatTime(inPerDay)} / day</p>
                </div>

                <div className="min-w-0 rounded-lg bg-[#F8FAFC] p-4 shadow-sm">
                  <p className="min-w-0 text-[13px] font-medium leading-5 text-[#475569]">Remote days without manual hours</p>
                  <p className="mt-2 text-[28px] font-semibold leading-9 text-[#0F172A]">{remotePlanningDays.length}</p>
                  <p className="mt-1 min-w-0 text-[13px] font-medium leading-5 text-[#64748B]">{formatTime(remotePerDay)} / day</p>
                </div>
              </div>
            </div>
          </aside>
        </section>

      </div>
    </main>
  );
}
