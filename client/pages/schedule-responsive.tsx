import { useIsMobile } from "@/hooks/use-is-mobile";
import ScheduleWeekMobile from "@/pages/schedule-week-mobile";
import Schedule from "@/pages/schedule"; // your existing desktop page

export default function ScheduleResponsive() {
  const isMobile = useIsMobile();
  return isMobile ? <ScheduleWeekMobile /> : <Schedule />;
}