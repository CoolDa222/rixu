import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatWeekRange, getWeekDates } from "../lib/date";

interface WeekToolbarProps {
  weekOffset: number;
  onChange: (offset: number) => void;
}

export function WeekToolbar({ weekOffset, onChange }: WeekToolbarProps) {
  const anchor = new Date();
  anchor.setDate(anchor.getDate() + weekOffset * 7);
  const dates = getWeekDates(anchor);

  return (
    <div className="week-toolbar">
      <div className="week-navigation">
        <button
          type="button"
          className="icon-button"
          title="上一周"
          aria-label="上一周"
          onClick={() => onChange(weekOffset - 1)}
        >
          <ChevronLeft size={19} />
        </button>
        <div>
          <span className="eyebrow">周视图</span>
          <strong>{formatWeekRange(dates)}</strong>
        </div>
        <button
          type="button"
          className="icon-button"
          title="下一周"
          aria-label="下一周"
          onClick={() => onChange(weekOffset + 1)}
        >
          <ChevronRight size={19} />
        </button>
      </div>
      {weekOffset !== 0 && (
        <button
          type="button"
          className="button button-quiet button-small"
          onClick={() => onChange(0)}
        >
          回到本周
        </button>
      )}
    </div>
  );
}
