# An M365 alternative for Big and Small

If Directorate staff already use work Outlook accounts backed by Exchange Online, start with two **room resource mailboxes**. Exchange holds the bookings, so this option needs neither Vercel nor Neon. This is a proposed approach, not a configured Microsoft 365 application.

## Start with the built-in option

Ask the Microsoft 365 / Exchange administrator to:

1. Create two room mailboxes in the Exchange admin centre under **Recipients → Resources**. Use directory names that identify the location, such as **Kavango East — Big** and **Kavango East — Small**. Set the location to Rundu and use Namibia time. The administrator assigns addresses on the Ministry's actual domain.
2. Configure automatic acceptance of permitted bookings and rejection of conflicting requests. Confirm that overlapping bookings are disabled and that no out-of-policy setting inadvertently permits conflicts. Choose the booking window, maximum duration and working hours according to the Directorate's agreed rules.
3. Allow the intended staff to view the calendars. Calendar permissions default to availability information, which can show only busy time. Configure organiser visibility explicitly. One approach is limited meeting details with the organiser included in the room event's subject; this can expose the organiser without giving every staff member permission to edit the room calendar or read the meeting body.
4. Help staff add both room calendars from the Outlook directory. They can display the calendars alongside one another and use Scheduling Assistant / Room Finder when booking.
5. Test with two different staff accounts: reserve Big, try an overlapping Big request, reserve Small at the same time, and cancel the first booking. Confirm that the room sends the expected acceptance or rejection and that names are visible to ordinary colleagues.

Staff create a meeting **in their own Outlook calendar**, choose the room as the location/resource, and set the start and end. They should wait for the room's acceptance. Changing or cancelling the meeting, or removing the room from it, updates the reservation. Avoid giving everyone direct editing rights to the room calendars as the normal booking method; use meeting requests so Exchange applies its booking policy.

The user experience is straightforward: open the two room calendars, find a free time, create a meeting and add Big or Small. The organiser is known from the work account, so names and ownership do not rely on someone typing a name or keeping a cancellation link.

## Add a branded interface if staff need one

A Power Apps canvas app could have almost the same layout as the supplied website:

- A Directorate-branded header and two room cards.
- A selected-day timetable showing Big and Small, the organiser and reserved times.
- A booking form with room, date, start and duration; the organiser comes from the signed-in user.
- A My bookings screen for changes and cancellations.

Embed the app in a Teams tab or on a SharePoint page. Keep the Exchange room calendars as the authoritative booking records. Use the user's own connection to create the Outlook meeting and invite the selected room. The app must distinguish a submitted request from an accepted reservation, and read the room's actual acceptance or rejection before claiming confirmation. Cancellation must update the organiser's Outlook event and release the room.

The Office 365 Outlook connector is classified as Standard and includes room discovery and event operations. However, the exact calendar-reading permissions, connection consent, acceptance-status handling and app licensing need a small pilot in the Ministry's tenant. Additional custom connectors or premium services can change licensing requirements. A basic SharePoint List calendar alone does not supply Exchange's automatic conflict handling. Also, SharePoint's Group calendar web part displays an M365 group calendar, rather than automatically displaying arbitrary room mailboxes.

## Which approach fits?

| Need | My recommended starting point |
| --- | --- |
| Staff already have work Outlook accounts; reliable booking is the priority | Two native Exchange room calendars |
| Staff want a branded booking dashboard in Teams or SharePoint | Power Apps interface over the same room calendars |
| Anyone with a link must see organisers and book without a work account | The supplied public website; the standard internal M365 approach assumes work-account access |

Microsoft Bookings supports public appointment pages, but is primarily organised around services and staff appointments. I would not start with it for a public two-room board showing who has booked every slot.

Room resource mailboxes normally do not require separate Microsoft 365 product licences. Staff still need the appropriate existing services. Check the tenant's Power Apps entitlements before commissioning a custom interface; a Standard connector classification is not, by itself, a promise that every proposed app is free.

## Official references

- [Microsoft: resource mailboxes and administration](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-resource-mailboxes)
- [Microsoft: room booking, cancellation and licence FAQ](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/room-equipment-mailboxes-faq)
- [Microsoft: Scheduling Assistant and Room Finder](https://support.microsoft.com/en-gb/outlook/use-the-scheduling-assistant-and-room-finder-for-meetings-in-outlook)
- [Microsoft: calendar permissions](https://learn.microsoft.com/en-us/exchange/collaboration-exo/shared-calendars/understand-calendar-delegate-permissions)
- [Microsoft: room calendar processing settings](https://learn.microsoft.com/en-us/powershell/module/exchangepowershell/set-calendarprocessing)
- [Microsoft: a configuration that can permit conflicting requests](https://learn.microsoft.com/en-us/troubleshoot/exchange/calendars/you-still-can-reserve-a-meeting-room-even-if-it-is-reserved)
- [Microsoft: Office 365 Outlook connector](https://learn.microsoft.com/en-us/connectors/office365/)
- [Microsoft: embed a Power Apps canvas app in Teams](https://learn.microsoft.com/en-us/power-apps/teams/embed-teams-tab)
- [Microsoft: use the Power Apps web part in SharePoint](https://support.microsoft.com/en-au/sharepoint/sites-pages/use-the-power-apps-web-part)
- [Microsoft: SharePoint group calendar web part](https://learn.microsoft.com/en-us/sharepoint/guided-walkthrough-creating-team-site)
- [Microsoft: Bookings overview](https://learn.microsoft.com/en-us/microsoft-365/bookings/bookings-overview)
