# PR: Change primary button color from blue to black

## Description
This PR changes the primary button color from blue to black throughout the application, ensuring a polished and accessible UI.

## Changes
- Modified CSS variables in `index.css` to set `--primary` to black
- Updated button hover/focus/active states
- Added global CSS overrides for consistency
- Changed explicit blue button classes to black in specific components
- Updated gradients to match the new black theme

## Accessibility
- Contrast ratio between button text (white) and background (black) is 21:1, far exceeding WCAG AA requirement of 4.5:1
- Maintained distinct visual states for hover, focus, active, and disabled states
- All buttons remain fully keyboard accessible

## Screenshots
<!-- Add before/after screenshots here -->

## Testing Checklist
- [ ] Primary buttons render black with white text across all pages
- [ ] Hover/focus/active states are visually distinct and consistent
- [ ] Disabled states are clearly visible
- [ ] Contrast ratio exceeds 4.5:1 (verified with axe or Lighthouse)
- [ ] No accidental changes to links, icons, charts or other elements
- [ ] Tested on mobile and desktop viewports

## Pages tested
- [ ] Login
- [ ] AdminDashboard
- [ ] LiveAttendance
- [ ] AttendanceLogs
- [ ] GroupWorkspace
- [ ] ManageStudents
- [ ] RegisterStudent
- [ ] Diagnostics

## Notes
Some blue elements intentionally remain unchanged:
- Links (underlined text)
- Status indicators and icons
- Charts and data visualizations