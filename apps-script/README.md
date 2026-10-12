# Set up online RSVPs with a Google Sheet

You do this once. It takes about five minutes.

1. Create a new Google Sheet. Name it "Wedding RSVPs".
2. Open **Extensions > Apps Script**. Delete the sample code and paste in all of `Code.gs`.
3. At the top, replace `CHANGE-ME-to-a-long-random-string` with a long random string (30 or more characters). This is your admin key. Keep it private.
4. Click **Deploy > New deployment**, choose the type **Web app**, then set:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy** and approve the permission prompt. Copy the **Web app URL** (it ends in `/exec`).
6. In the planner, open **Event & directions**. Paste the URL and your admin key under "Online RSVP", then press **Save details**.
7. Open **Share** and press **Sync with Google Sheet**. Your guests appear in the sheet.
8. Send each guest their personal link from the **Personal links** list.

## How it works

- A guest's link carries a secret token. It lets them see their own name and reply. It cannot read anyone else's row.
- Replies are written to the sheet. Press **Sync** in the planner to pull them into your counts.
- If you change a guest's RSVP in the planner, it overwrites the sheet on the next sync. If you change one in the sheet, the planner takes the sheet's value.
- Anyone who has a personal link can change that guest's answer. Send each link only to that guest.
- If you edit `Code.gs` later, use **Deploy > Manage deployments > Edit > New version**, or the old code keeps running.
