export interface Sample {
	id: string;
	name: string;
	text: string;
}

export const SAMPLES: Sample[] = [
	{
		id: 'adaptation-fund-email',
		name: 'Funding call email (messy)',
		text: `Subject: FWD: FWD: Urban Adaptation Facility — call for proposals, pls circulate!!

Hi all — forwarding this from the regional office, apologies for the formatting, copied out of a PDF.

The Coastal & Urban Adaptation Facility (CUAF) is now accepting concept notes for its 2026
small grants window ("Resilient Neighborhoods"). Grants of USD 50,000 to 250,000 for
city-level adaptation projects. NOTE the deadline moved — it is now 15 August 2026, 17:00 CET
(was originally end of July, ignore the date in the attached flyer).

Eligibility (from the FAQ, roughly):
- registered NGOs or city governments in eligible countries (list attached, basically
  the usual LDC + SIDS list plus some middle-income coastal cities)
- must show co-financing of at least 10% — in-kind counts
- projects under 24 months
- NO pure research projects, must have implementation component

Couple of things to flag from our side: the co-financing letter needs to be signed by a
director, and finance says getting that takes 3+ weeks, so that's tight. Also the facility
flagged last year that proposals scored poorly when the community engagement plan was
thin — they rejected ~70% on that basis. And honestly the 24-month cap is a risk for the
mangrove component, the planting windows mean we'd effectively have 18 months.

Maria said she can draft the concept note by July 20 if someone else handles the budget
annex (Tomás?). Budget ceiling for staff costs is 30% btw.

Can we get a decision on whether we're going for this by Friday's standup?

thanks,
J.`,
	},
	{
		id: 'project-notes',
		name: 'Project meeting notes',
		text: `Mangrove corridor restoration — partner sync, 3 June 2026 (raw notes)

attendance: us, BlueShore Trust, municipal env. dept (only joined for first half), GIS team

- nursery throughput is the bottleneck again. BlueShore can supply 40k seedlings/season max,
  we modeled 60k. options: second nursery (cost?? Ana to price by next week) or slip the
  schedule by one season
- municipality STILL hasn't issued the land-use letter for parcels 12-14. without it we
  can't plant the northern segment. legal says if it's not signed by end of June we should
  escalate to the deputy mayor. risk: parcels get reassigned to the port expansion
- drone survey shows ~12% mortality in last season's planting, mostly the exposed western
  edge. agronomist suggests switching species mix there (A. marina instead of R. mucronata)
- community payments: 3 villages onboarded, 2 pending MOUs. treasurer worried about cash
  handling, wants mobile money only from Q3
- funder report due July 31. needs: updated hectares figure, mortality analysis, photos
- NEXT: Ana costs nursery #2 (June 12), Karim drafts escalation letter (June 20),
  field team replants western edge w/ new mix (before July rains)`,
	},
];
