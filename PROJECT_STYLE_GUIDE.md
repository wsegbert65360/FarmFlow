# PROJECT_STYLE_GUIDE

## Environment Configuration
To ensure proper operation of browser-based verification tools on Windows, the `$HOME` environment variable must be mapped to the user's profile directory.

### Global Mapping Fix
Run the following PowerShell command to set the variable for the current process and sub-processes:
```powershell
$env:HOME = $env:USERPROFILE
[System.Environment]::SetEnvironmentVariable('HOME', $env:USERPROFILE, 'Process')
```

To persist this change for the user:
```powershell
[System.Environment]::SetEnvironmentVariable('HOME', $env:USERPROFILE, 'User')
```

## Functional Consistency Standards
- **Plant Button (Green):** Must pre-fill `field_id` in the PlantingLog form.
- **Spray Button (Blue):** Must auto-fetch and pre-fill current local weather data.
- **Harvest Button (Gold):** Triggers `HARVEST_TO_TOWN` by default to ensure grain movement tracking.
- **Global FAB (+):** Must open a selection menu for activities not tied to a specific field.
- **Hit Targets:** All interactive elements must maintain a minimum 44x44px hit target for accessibility.
- **Sync Feedback:** All "Pending" states should be interactive, allowing users to manually trigger a sync retry.
