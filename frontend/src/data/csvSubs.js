// Ethara — Subscriptions per project (App Sheet · Subs CSV)
// Aggregated as one row per (phase × subscription) with the member names on that seat set.
// Seat pricing: $200/month for Claude Code Max and Codex (per the sheet). Each row = 1 seat/member.
// The exported map is keyed by project slug (matches csvProjects.js slugify(internal)).

const S = 200; // per-seat monthly cost

const mk = (phase, sub, members) => ({ phase, sub, seatCost: S, seats: members.length, members });

export const CSV_SUBS_BY_INTERNAL = {
  kensei: [
    mk("Phase 1", "Claude Code Max", ["Navya Arora", "Ayan Choudhary"]),
    mk("Phase 2", "Claude Code Max", ["Sanvi Gupta", "Saharsh Karandikar", "Rohit Harshwal", "Sanskriti Singh Baghel", "Kushagra Gangwar"]),
    mk("Phase 6", "Claude Code Max", ["Sonu Sharma", "Riya Jha", "Rewati Raman Prasad", "Adarsh Raj", "Saurav Kumar", "Anchal Mittal", "Yogendra Mishra", "Kshitij Bhardwaj", "Harshaksh Singh", "Adarsh Raghuvanshi", "Pankaj Kumar", "Rishabh Ramayane", "Dev Baghel", "Rahul Yadav", "Mohit Singh", "Surobhi Pal", "Dinshi Jain", "Shruti Agnihotri", "Preksha Jain", "Shivani Sehgal", "Sanskar Gupta", "Varun Kumar", "Sanskriti Singh Baghel", "Rohit Harshwal", "Abhishek Sharma", "Soujanya Gupta", "Viksit Chauhan", "Ayush Chauhan", "Sagar Agrahari", "Harsh Kumar Singh", "Vidit Sharma", "Prafful Gupta", "Vidit Mujumdar", "Kaustubh Dalvi", "Harshit Singh", "Shivam Choudhary", "Raksha Singh", "Gaurav kumar", "Ram Lalit Chaudhary", "Swarnim Jain", "Shreeyank Doliya", "Poonam Chourey", "Janhvi Matkar", "Saksham Jindal", "Sugam Agrawal", "Khushi Tomar", "Prerna Deshwal", "Sakshi Tripathi", "Suchit Negi"]),
    mk("Phase 7", "Claude Code Max", ["Preksha Jain", "Adhya Agarwal", "Aniket Tyagi", "Kanishk Singh", "Mansa Gupta", "Supriya Verma", "Aditi Jain", "Vishakha Bisen", "Jaskaran Singh Oberoi", "Prince Kasana", "Ayush Meena", "Prakhar Goel", "Sarvex Jatasra", "Md Danish Samir", "Suchit Negi", "Sugam Agrawal", "Janhvi Matkar", "Poonam Chourey", "Harshit Singh", "Saksham Jindal", "Kaustubh Dalvi", "Khushi Tomar", "Ram Lalit Chaudhary", "Swarnim Jain", "Rishabh Ramayane", "Gaurav kumar", "Shivam Choudhary", "Prerna Deshwal", "Raksha Singh", "Shivendra Shukla", "Soujanya Gupta", "Navya Arora", "Arth Pathak", "Yuvraj Singh Chandrawat", "Yash Handa", "Aditya Patel", "Nargis Vats"]),
  ],
  "arc-agents": [mk("Phase 1", "Claude Code Max", ["Abhishek Mishra"])],
  fenrir: [
    mk("Phase 1", "Claude Code Max", ["Prafful Gupta", "Tejas Shah"]),
    mk("Phase 2", "Claude Code Max", ["Animesh Giri Goswami", "Vyom Sahu"]),
  ],
  raiden: [mk("Phase 1", "Claude Code Max", ["Krishna Bairagi", "Aniket Soni", "Sagar Agrahari"])],
  kaiju: [mk("Phase 1", "Claude Code Max", ["Vaibhav Singh", "Madhur Parwal", "Prakhar Singh"])],
  aurora: [mk("Phase 1", "Claude Code Max", ["Shraiy Khaddar", "Sagarika Nayak", "Ankit Porwal"])],
  goku: [mk("Phase 2", "Claude Code Max", ["Vaishnavi Nighojkar"])],
  freya: [mk("Phase 1", "Claude Code Max", ["Piyush Singh Tomar"])],
  talos: [mk("Phase 1", "Claude Code Max", ["Manas Ahuja", "Anupam Saini", "Snehil Maurya", "Vaibhav Singh"])],
  vegeta: [mk("Phase 1", "Claude Code Max", ["Manas Ahuja", "Anupam Saini"])],
  valkyrie: [mk("Phase 3", "Claude Code Max", ["Krishnansh Vyas", "Rajni Kant Singh", "Vaibhav Singh", "Madhur Parwal"])],
  kraken: [mk("Phase 4", "Claude Code Max", ["Snehil Maurya", "Rajni Kant Singh", "Pratham Shukla"])],
  crowley: [mk("Phase 5", "Claude Code Max", ["Piyush Agrawal", "Tanmay Khandelwal"])],
  agon: [mk("Phase 6", "Claude Code Max", ["Shubham Laxman Pawar"])],
  enyo: [
    mk("Phase 4", "Claude Code Max", ["Aditi Jain", "Aniket Tyagi"]),
    mk("Phase 5", "Claude Code Max", ["Preksha Jain", "Adhya Agarwal", "Kanishk Singh", "Mansa Gupta", "Supriya Verma", "Rajni Kant Singh", "Vishakha Bisen", "Jaskaran Singh Oberoi", "Prince Kasana", "Ayush Meena", "Prakhar Goel", "Sarvex Jatasra", "Kashif Ahmed", "Shamy Ahmad", "Faiyaz Ahmad", "Md Danish Samir"]),
    mk("Phase 6", "Claude Code Max", ["Chirag Jain", "Megha Singh", "Nitish Tiwari", "Shubham Laxman Pawar", "Pratham Shukla", "Sanket Porwal", "Harsh Gupta", "Nikhil Bansal", "Amandeep Bareth", "Aditi Sharma", "Sanskriti Singh Baghel", "Harshal Khairnar", "Sanvi Gupta", "Utsav Jain"]),
    mk("Phase 7", "Claude Code Max", ["Vinit Vani"]),
  ],
  mephisto: [mk("Phase 8", "Claude Code Max", ["Tanmay Khandelwal", "Krishnansh Vyas", "Snehil Maurya", "Shreyansh Parashar", "Piyush Agrawal"])],
  "kensei-sft": [
    mk("Phase 8", "Claude Code Max", ["Ketan Patel", "Aman Singh Gurjar", "Aditya Joshi", "Varshaj Chouhan", "Pranay Jain", "Ajay Jangid", "Astha Shukla", "Vaishnavi Nighojkar", "Rahul Yadav"]),
    mk("Phase 8", "Codex", ["Shreeyank Dholiya", "Swarnim Jain", "Ram Lalit chaudhary"]),
  ],
  zoro: [
    mk("Phase 7", "Claude Code Max", ["Shubham Chaturvedi", "Mumukshu Panchal", "Dhawal Bathre"]),
    mk("Phase 8", "Codex", ["Mumukshu Panchal", "Shubham Chaturvedi"]),
  ],
  tron: [
    mk("Phase 7", "Claude Code Max", ["Piyush Chandra"]),
    mk("Phase 8", "Codex", ["Piyush Chandra", "Viksit Kumar Chauhan"]),
  ],
  "tooling-team": [
    mk("Phase 7", "Claude Code Max", ["Akhil Gupta", "Dhiraj Singh"]),
    mk("Phase 8", "Codex", ["Dhiraj Singh"]),
  ],
  ots: [
    mk("Phase 8", "Claude Code Max", ["Vaibhav Singh", "Shivansh Rai", "Aman Yadav", "Aditi Singh Baghel", "Amrit Raj", "Prakhar Singh", "Madhur Parwal"]),
    mk("Phase 8", "Codex", ["Vaibhav Singh", "Shivansh Rai", "Prakhar Singh", "Aditi Singh Baghel", "Amrit Raj"]),
  ],
  "diu-goku": [mk("Phase 7", "Codex", ["Astha Shukla"])],
  generalist: [mk("General", "Claude Code Max", ["Anjali Bhagoria"])],
};

// Convert to project-level fields: subscriptions list + budgetItems.subs rows.
export const subsSummaryFor = (projectId) => {
  const rows = CSV_SUBS_BY_INTERNAL[projectId] || [];
  if (!rows.length) return { subscriptions: [], subsBudgetItems: [], totalCost: 0, totalSeats: 0 };
  const subsBudgetItems = rows.map((r, i) => ({
    id: `${projectId}-sub-${i + 1}`,
    name: `${r.sub} · ${r.phase}`,
    seats: r.seats,
    unitCost: r.seatCost,
    monthly: r.seats * r.seatCost,
    members: r.members,
  }));
  const totalCost = subsBudgetItems.reduce((s, i) => s + i.monthly, 0);
  const totalSeats = rows.reduce((s, r) => s + r.seats, 0);
  return { subscriptions: rows, subsBudgetItems, totalCost, totalSeats };
};
