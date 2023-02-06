import GoogleSheets from "https://madata.dev/backends/google/sheets/google-sheets.js";
import { Vue, SetData } from "https://mavue.mavo.io/mavue.js";

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

let f2f = params.get("f2f") ?? "Moonbase Alpha";

let slots = await (new GoogleSheets("https://docs.google.com/spreadsheets/d/1D7low9ygKMXzzFcClTh5Q75JQwHTLdzpW0qPv1BSsUU/edit#gid=1326461427", {
	range: "A6:X15", transpose: true, headerRow: true, sheet: `${f2f} Person x Breakout`
})).load();
let issues = (new GoogleSheets("https://docs.google.com/spreadsheets/d/1D7low9ygKMXzzFcClTh5Q75JQwHTLdzpW0qPv1BSsUU/edit#gid=1478762209", {
headerRow: true, sheet: f2f
})).load();

// console.log(slots)

let breakouts = {};
let participants = new Set();

// First, determine participants for each breakout
for (let slot of slots) {
	for (let participant in slot) {
		let id = slot[participant];

		if (id && id.toLowerCase() !== "x") {
			let breakout = (breakouts[id] ??= {});
			breakout.participants ??= [];
			breakout.participants.push(participant);
			participants.add(participant);
		}
	}
}

issues = await issues;

// console.log(issues);

// Then, issues for each breakout
for (let issue of issues) {
	let slot = issue.Slot;

	if (!slot) {
		continue;
	}

	if (!(slot in breakouts)) {
		// Orphan breakout with no participants!
		breakouts[slot] = {orphan: true};
	}

	let breakout = breakouts[slot];
	breakout.issues ??= [];
	breakout.issues.push({
		name: issue.Name,
		url: issue.URL,
		comment: issue.Comments,
	});
}

console.log(breakouts);

app.breakouts = breakouts;
app.participants = participants;