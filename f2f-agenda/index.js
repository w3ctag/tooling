import GoogleSheets from "https://madata.dev/backends/google/sheets/google-sheets.js";
import { Vue, SetData } from "https://mavue.mavo.io/mavue.js";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1D7low9ygKMXzzFcClTh5Q75JQwHTLdzpW0qPv1BSsUU/edit";

let params = new URL(location).searchParams;

globalThis.app = Vue.createApp({
	data () {
		return {
			breakouts: {},
			participants: new Set(),
			filter: {
				participants: [],
				anyorall: "any"
			}
		};
	},

	mounted () {
		app_el.classList.remove("loading");
	},

	computed: {
		countShown () {
			return Object.values(this.breakouts).filter(b => b.shown).length;
		},

		countIsusuesShown () {
			return Object.values(this.breakouts).filter(b => b.shown).reduce((a, b) => a + (b.issues?.length || 0), 0);
		}
	},

	watch: {
		"filter.markdown": function () {
			document.documentElement.classList.toggle("markdown", this.filter.markdown);
		}
	},

	methods: {
		isShown (breakout) {
			if (this.filter.participants.length === 0) {
				return true;
			}

			let showParticipants = new Set(this.filter.participants);
			let intersection = breakout.participants.filter(p => showParticipants.has(p));

			if (this.filter.anyorall === "all") {
				return intersection.length === showParticipants.size;
			}

			return intersection.length > 0;
		}
	},

	components: {
		"set-data": SetData
	}
}).mount("#app_el");

let meeting = params.get("f2f");
let isVirtual = false;

if (!meeting) {
	meeting = params.get("vf2f");

	if (meeting) {
		isVirtual = true;
	}
}

let [slots, issues, participants] = await Promise.all([
	isVirtual ? GoogleSheets.load(SHEET_URL, {
		range: "A6:X15", transpose: true, headerRow: true, sheet: `${meeting} Person x Breakout`
	}) : null,
	GoogleSheets.load(SHEET_URL, {
		headerRow: true, sheet: meeting
	}),
	params.get("participants") ? GoogleSheets.load(SHEET_URL, {
		headerRow: true, sheet: meeting + " Planning", range: params.get("participants")
	}) : null,
]);

// console.log("Slots:", slots);

let breakouts = {};
let members = new Set();

// First, determine participants for each breakout
if (participants) {
	for (let breakoutMeta of participants) {
		let id = breakoutMeta.Slot;

		if (!id) {
			continue;
		}

		let breakout = (breakouts[id] ??= {});
		breakout.participants = breakoutMeta.Who?.split(/,/).map(x => x.trim()).filter(x => /^[A-Z][a-z]+/.test(x) && x !== "All").sort() ?? [];
		for (let participant of breakout.participants) {
			members.add(participant);
		}
		breakout.location = breakoutMeta.Where;
		breakout.goals = breakoutMeta.Goals;
	}
}
else if (slots) {
	for (let slot of slots) {
		for (let participant in slot) {
			let id = slot[participant];

			if (id && id.toLowerCase() !== "x") {
				let breakout = (breakouts[id] ??= {});
				breakout.participants ??= [];
				breakout.participants.push(participant);
				members.add(participant);
			}
		}
	}
}

// console.log(issues);

// Then, issues for each breakout
for (let issue of issues) {
	let slot = issue.Slot;

	if (!slot) {
		// Issue not assigned to a slot, skip
		continue;
	}

	breakouts[slot] ??= {};
	let breakout = breakouts[slot];
	breakout.issues ??= [];
	breakout.issues.push({
		name: issue.Name,
		url: issue.URL,
		comment: issue.Comments,
	});

	if (!breakout.participants) {
		// We have not fetched slots, calculate participants from issues

		if (!members.size) {
			// First time, calculate which columns are participants
			let keys = Object.keys(issue).filter(x => !["Slot", "Repo", "#", "Name", "URL", "Comments"].includes(x));
			members = new Set(keys);
		}

		breakout.participants = new Set();
	}

	// If we have no explicit schedule, try to guess participants from issue
	if (!participants && !slots) {
		for (let participant of members) {
			if (slot === "02b") console.log(issue.Name, participant, issue[participant])
			if (issue[participant]) {
				breakout.participants.add(participant);
			}
		}
	}
}

for (let id in breakouts) {
	let breakout = breakouts[id];
	breakout.participants = [...breakout.participants].sort();
}

console.log(breakouts);

app.breakouts = breakouts;
app.participants = members;