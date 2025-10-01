# Manual Testing Instructions

## Button Color Change Testing Guide

### Prerequisites
1. Clone the updated branch with black button styling
2. Install dependencies with `npm install` or `bun install`
3. Start the development server with `npm run dev` or `bun run dev`

### Test Scenarios

#### 1. Basic Button Appearance
- **Primary buttons** should have:
  - Black background (#000000)
  - White text
  - No visible border in normal state
  - Subtle darkening effect on hover (80% opacity)

#### 2. Button States
- **Hover state**: Buttons should darken slightly when hovered
- **Focus state**: Buttons should show a focus ring when tabbed to
- **Active state**: Buttons should show a pressed effect when clicked
- **Disabled state**: Buttons should appear at 50% opacity and not respond to clicks

#### 3. Key Pages to Test

| Page | Buttons to Test | Expected Appearance |
|------|----------------|---------------------|
| Login | Submit button | Black with white text |
| AdminDashboard | Action buttons | Black with white text |
| LiveAttendance | Capture buttons | Black with white text |
| GroupWorkspace | Group action buttons | Black with white text |
| ManageStudents | Add/Edit/Delete buttons | Black with white text |
| RegisterStudent | Submit button | Black with white text |
| Diagnostics | Test buttons | Black with white text |

#### 4. Accessibility Testing
- Run Lighthouse audit to verify contrast ratio ≥ 4.5:1
- Test keyboard navigation (Tab, Enter, Space) to ensure all buttons are accessible
- Verify that screen readers announce buttons correctly

#### 5. Responsive Testing
- Test on mobile viewport (≤ 480px)
- Test on tablet viewport (≤ 768px)
- Test on desktop viewport (≥ 1024px)

#### 6. Edge Cases
- Verify that links (blue text) remain distinguishable from buttons
- Check that icons and status indicators that should remain blue are unchanged
- Ensure that charts and data visualizations maintain their original colors