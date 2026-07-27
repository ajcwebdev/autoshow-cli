---
title: "Barnum with Robert Balicki"
slug: "2026-06-30-barnum-with-robert-balicki"
duration: "2:30:00"
channel: "Anthony Campolo"
url: "https://www.youtube.com/watch?v=XOKqH0kne_M"
publishDate: "2026-06-30"
thumbnail: "https://i.ytimg.com/vi/XOKqH0kne_M/maxresdefault.jpg"
channelURL: "https://www.youtube.com/channel/UCpdzti0GURPfMjKzYK5FVSA"
description: "00:00:03 - Robert Balicki Introduces Pinterest, Relay, and GraphQL Migration
00:03:38 - Learning to Code Through Automation, Math, and Statistics
00:06:00 - Rust NYC, Meta Hiring, and Joining the Relay Team
00:10:17 - Conference Talks, Relay Education, and Public Speaking
00:14:20 - Why Speaking Helps Careers and Community Connections
00:17:26 - Early AI Interest and the Path Toward Barnum
00:21:17 - Barnum as a TypeScript DSL Executed by Rust
00:25:30 - Code Mode and Tool-Calling Through Generated Programs
00:28:07 - Reliability, Unit Tests, and Keeping Agents Inside Guardrails
00:32:24 - Demo Setup and the Case for a TypeScript Workflow DSL
00:36:27 - Automated Refactor PRs and Barnum Demo Goals
00:38:19 - Cataloging Refactors Across Large Codebases
00:41:08 - Using AI Workshops and Refactor Pipelines at Scale
00:43:01 - Stacked PRs, Rebasing, and Barnum Babysitting
00:45:02 - Barnum Quick Start and Workflow Structure
00:48:11 - Running a Refactor Workflow from the CLI
00:51:38 - Extracting Refactors Before Implementation
00:54:05 - Loops, Queues, and Barnum Control Flow
00:57:41 - Schema-Checked Agent Output for Refactor Instructions
01:00:00 - File Scope, Cross-File Context, and Refactor Heuristics
01:03:24 - Splitting Large Framework Migrations into Focused Agent Tasks
01:06:35 - Agents, Code Mods, and Narrow Tool Permissions
01:08:23 - Implementation Queues and Categorizing PRs
01:12:16 - Fixing Failed Checks with Controlled Retry Loops
01:14:30 - Deterministic Outer Loops and Prompted Inner Work
01:16:27 - Concurrency, Worktrees, and Resource Limits for Agents
01:21:21 - Barnum Portability and Future Workflow Patterns
01:23:01 - Code Mode Limitations and Resumable Execution
01:27:15 - Handler Isolation and Multi-Language Workflow Targets
01:30:48 - Why Barnum Uses Rust and an Intermediate A-Step
01:34:40 - Temporal Comparisons and Durable Execution Tradeoffs
01:36:46 - Introducing Isograph and the Value of GraphQL Fragments
01:40:21 - GraphQL Versus REST and Local Reasoning for Humans and LLMs
01:42:32 - Fragments, Components, and Isograph’s Compile-Time Connection
01:45:22 - Selecting UI Fields Through Isograph Schema Augmentation
01:48:03 - Generated Queries, Artifacts, and Low-Boilerplate Components
01:49:37 - Loadable Data and JavaScript for Deferred UI
01:51:08 - Discoverability, Directives, and Extending GraphQL Syntax
01:53:18 - UI-Specific Schema Fields and Server-Side Execution Plans
01:58:21 - Server Execution, Security, and React Server Component Comparisons
02:00:16 - Isograph Adoption and Bolt Foundry Usage
02:02:20 - Compiler Behavior, Isograph Literals, and Build Steps
02:05:07 - Generated Resolver Files and Backend Target Possibilities
02:08:16 - Caching, Normalized Stores, and Suspense Navigation
02:12:06 - Minimal Recalculation and Fine-Grained Rendering
02:13:38 - Why Solid Could Fit Isograph’s Model
02:17:16 - Performance Through Dependency-Aware Rerenders
02:20:20 - Build-Time Component Splitting and Future Isograph Ideas
02:22:05 - Pet Demo Setup and Cached Navigation Behavior
02:24:18 - Instant Revisited Pages and Local Store Reads
02:26:13 - Granular Rerenders and Final Demo Takeaways
02:27:22 - Wrap-Up, Socials, and Getting Started with Barnum"
---

This is a transcript with timestamps. Do not include advertisements in the summaries or descriptions. Do not actually write the transcript.

- Write a one-sentence description of the transcript.
  - The one-sentence description shouldn't exceed 180 characters (roughly 30 words).

- Write a one-paragraph summary.
  - The one-paragraph summary should be approximately 600-1200 characters (roughly 100-200 words).

- Create chapter titles and descriptions based on the topics discussed throughout.
  - Include only starting timestamps in exact HH:MM:SS format, always using two digits each for hours, minutes, and seconds.
  - Chapters should each cover approximately 3-6 minutes of content.
  - Write a two-paragraph description (75+ words) for each chapter.
  - Ensure chapters cover the entire content, clearly noting the last timestamp (HH:MM:SS), indicating total duration.
  - Descriptions should flow naturally from the content, avoiding formulaic language.

Example JSON output:

{
  "shortSummary": {
    "episodeDescription": "A concise one-sentence description of the transcript in 180 characters or fewer."
  },
  "longSummary": {
    "episodeSummary": "A single-paragraph summary of the transcript that explains the central topic, the main arguments or developments, the evidence or examples used to support them, and the broader takeaway for the audience. It should read as one cohesive paragraph rather than a list, staying informative without becoming exhaustive. The summary should mention the most important themes, clarify what changed or was learned over the course of the discussion, and note any conclusions, recommendations, or implications that would help someone understand the full conversation without reading the entire transcript. It should also preserve the flow of the discussion so the reader can follow how the ideas developed from beginning to end."
  },
  "longChapters": {
    "chapters": [
      {
        "timestamp": "00:00:00",
        "title": "Introduction and Overview",
        "description": "Introduces the episode's central themes, outlines the main questions guiding the discussion, and explains why the topic matters in practical terms. The chapter gives the audience enough context to follow the conversation, surfaces the core tension or opportunity, and establishes the language that will be revisited in later sections.\n\nIt also signals how the discussion will unfold, connecting the opening ideas to the examples, methods, or case studies that follow. By the end of the chapter, the listener understands the scope of the conversation and the stakes behind the next set of arguments."
      },
      {
        "timestamp": "00:04:30",
        "title": "Core Ideas and Implications",
        "description": "Introduces the episode's central themes, outlines the main questions guiding the discussion, and explains why the topic matters in practical terms. The chapter gives the audience enough context to follow the conversation, surfaces the core tension or opportunity, and establishes the language that will be revisited in later sections.\n\nIt also signals how the discussion will unfold, connecting the opening ideas to the examples, methods, or case studies that follow. By the end of the chapter, the listener understands the scope of the conversation and the stakes behind the next set of arguments."
      }
    ]
  }
}

Transcript:
[00:00:03] [speaker-0] And we're live. Welcome back, everyone, to AJC in the web devs. We have a very special episode today. We have a new guest. Never been here before,
[00:00:13] [speaker-0] Robert. Really happy to have you. You're a GraphQL OG. You're working on some cool AI stuff.
[00:00:20] [speaker-0] So why don't you go ahead and introduce yourself and let our listeners know, who you are and what you do? Awesome. Hey, folks. My name is Robert. Super pumped to be up here.
[00:00:31] [speaker-1] I guess, Dev and I go, at this point in time, way back, but, like,
[00:00:35] [speaker-1] it's the first time no. It's the second time that I'm that I'm doing a stream with you. So I'm, like, really, really excited about this to keep this tradition going. I was curious about that, actually. React Miami.
[00:00:45] [speaker-1] Yeah. There we go. Yeah. Oh, what year?
[00:00:50] [speaker-2] '24,
[00:00:51] [speaker-2] I believe.
[00:00:52] [speaker-0] '24. Okay. I was there in 2023.
[00:00:55] [speaker-0] Yes. I loved it. It's really fun. That is it's my favorite conference.
[00:01:00] [speaker-1] I want to go one day as not well, the first time I went was not as a speaker, as an attendee, and that's the way to go. Because last or this year, I went as a speaker,
[00:01:09] [speaker-1] and I was just holed up in my room practicing
[00:01:12] [speaker-1] right right until the very end, so I got to miss all the really cool events.
[00:01:16] [speaker-1] Oh, well. Oh, well. It's all good. Yeah. So my name is Robert. Quick intro is that I currently work at Pinterest,
[00:01:24] [speaker-1] where I'm on the web platform team. Before this, I was at, Meta on the Relay team.
[00:01:29] [speaker-1] At Pinterest, the primary thing that I've been working on is helping the company adopt GraphQL on web.
[00:01:35] [speaker-1] And the sort of the big reason why that's not super easy is because if you start converting a screen to use GraphQL, you're not only fetching data in a different shape, you're also fetching it from a different endpoint. So you kinda have a couple of bad options. One is rewrite the whole screen. Good luck. And the other is make more
[00:01:53] [speaker-1] network requests,
[00:01:54] [speaker-1] which hurts performance.
[00:01:56] [speaker-1] So sort of the my sort of marquee thing there at Pinterest has been working on the
[00:02:01] [speaker-1] Relay migration API. Relay is a framework for building,
[00:02:05] [speaker-1] GraphQL or data driven apps powered by GraphQL, which I worked on at Meta.
[00:02:10] [speaker-1] And the Relay migration API essentially allows you to allow
[00:02:14] [speaker-1] to make components
[00:02:16] [speaker-1] agnostic about where they get their data from. So you can start at the leaf and make the component not care whether it gets REST or GraphQL data and then sort of build your way up. Once you get to the root, run some experiment and actually flip on GraphQL for an entire screen at once. And, that's pretty cool because a lot of times you turn that on and you discover, hey. There's some some missing logging on the back end or performance isn't quite where you got where you wanted it. So this is kinda nice.
[00:02:41] [speaker-0] Yeah. Anyway, really excited to be on here. So No. That that's super cool. We're we're gonna get deeper into GraphQL probably in the the second half of the episode. I had said before the show, I'd be curious to hear your kind of coding
[00:02:54] [speaker-0] backstory. I always like to know how people, you know, first learn to code.
[00:02:58] [speaker-0] We we've never met before. I was a a boot camp kind of student. I originally had a music major
[00:03:04] [speaker-0] and then got into all this stuff through,
[00:03:07] [speaker-0] you know, later in life, like, late twenties.
[00:03:09] [speaker-0] And
[00:03:10] [speaker-0] Redwood was kind of how I became into open source, and that was, you know, a GraphQL framework. Didn't use Relay. Used Apollo client.
[00:03:18] [speaker-0] So, I I've I've said that, actually, the the one GraphQL project that I never really went super deep into was Relay. I went deep into almost all of them, which is kind of ironic because I would argue Relay is probably the most important GraphQL project ever in certain ways.
[00:03:34] [speaker-0] So I would definitely be curious to hear more about that from you. But, yeah. So, what was your your first line of code, your first language? How did you first start programming?
[00:03:43] [speaker-1] I I think I did a little bit of,
[00:03:46] [speaker-1] logo. I don't know if y'all remember that one.
[00:03:49] [speaker-1] Oh, yeah. Heard of it. You the little triangle that moves around.
[00:03:53] [speaker-1] But I think the biggest
[00:03:56] [speaker-1] I didn't really do all that much coding
[00:03:59] [speaker-1] until I was, let's say, 22 or so, and I had my first job out of college.
[00:04:03] [speaker-1] And
[00:04:05] [speaker-1] it was building reports
[00:04:07] [speaker-1] in Excel and doing them in PowerPoint and stuff like that, doing, like, market research. And I just ended up, like, automating a lot of my job,
[00:04:15] [speaker-1] and that was that was awesome. Like, it took something that used to take several weeks per month and, like, turned into, like, a fifteen minute process,
[00:04:23] [speaker-1] basically.
[00:04:25] [speaker-1] You have, like, a high No. That made me
[00:04:27] [speaker-1] no. No. I'd major in math and stats. So I did a little bit, like, statistics programming and stuff like that. But, like Yeah. Gotcha.
[00:04:33] [speaker-1] No
[00:04:35] [speaker-1] coding standards
[00:04:36] [speaker-2] Mhmm. Right. Yeah. At that point. That explains the username.
[00:04:39] [speaker-1] Yeah. Yes. I think that's I got my statistics FTW
[00:04:44] [speaker-1] Twitter account around that time. So
[00:04:47] [speaker-0] Yeah. You like the what do you what do you think of the that quote? There's lies, damn lies, and statistics.
[00:04:53] [speaker-1] I think it's awesome. I think honest honestly, like, statistics is I'm very happy that I've studied statistics,
[00:04:59] [speaker-1] even more so, I think, than than studying math. Both are very interesting.
[00:05:03] [speaker-1] I ended up I started out majoring in political science.
[00:05:06] [speaker-1] And during my freshman year, I wrote one essay on the history of the Peloponnesian war on the Melian dialogue. And, like, I I used it three times in different classes, and I was like, oh, this is not fun. Like, I but if you if you have the opportunity to get away with it, you do. And on the other hand, I took, like, the stats and Polysci course, and it allow us allowed me to, like, make these precise statements,
[00:05:29] [speaker-1] like, first introduction to, like, p values and stuff like that. And I was like, this is so much cooler rather than sort of the airy, foofy,
[00:05:37] [speaker-1] world of writing that I that I had come from.
[00:05:41] [speaker-0] Yeah. No. That's that's super cool.
[00:05:43] [speaker-0] It's a really interesting background.
[00:05:46] [speaker-0] So
[00:05:47] [speaker-0] just a little more on that. How did you get involved in Meta? Because I'm assuming you weren't you weren't hired to, like, do GraphQL or maybe you were. How how did that work?
[00:05:58] [speaker-1] I worked for a bunch of startups when I got into tech, and then I ended up changing
[00:06:03] [speaker-1] and getting a job at Meta.
[00:06:06] [speaker-1] I actually run Rust NYC,
[00:06:09] [speaker-1] and I had presented about a framework that I built for building,
[00:06:13] [speaker-1] web apps that where you write Rust and it compile I mean, superficially looks like React,
[00:06:18] [speaker-1] and it compiles into WebAssembly. And somebody from Meta was in the audience, so I think they kinda pushed for,
[00:06:26] [speaker-1] me in the back.
[00:06:27] [speaker-1] I don't know. But I guess .nyc
[00:06:30] [speaker-1] at the Yeah. Rust.nyc
[00:06:32] [speaker-1] is the,
[00:06:34] [speaker-1] is I think that's our domain.
[00:06:37] [speaker-1] Yes. That's it. That's you can find it. You can find, you can get access to the Discord there.
[00:06:42] [speaker-1] We actually are associated with a bunch of other meetups at this point in time, like Rust Boston.
[00:06:47] [speaker-1] There's we're starting a couple in
[00:06:50] [speaker-1] Florida. We have some going in LA and San Jose. So, like, the empire grows. Cool. Let me know if you ever wanna get a Saint Louis one going. Oh, yeah. We absolutely would love that. And we can provide whatever support you need as well. I'm thinking, like, what would be really cool is to have a circuit where we basically share speakers. And if they happen to be in whatever destination,
[00:07:11] [speaker-1] then we can arrange for them to have a, you know, a meetup on relatively short notice.
[00:07:16] [speaker-0] Oh, I love that you guys are involved in the the meetup stuff because, I used to do a lot of the the Jamstack meetups. I I mostly virtual because I Mhmm. I got into coding in 2020. So it was, like, the time to do online meetups.
[00:07:31] [speaker-0] So I I remember when I was, like I think it was, you know, September, October, November, I had, like, a I would do there's I remember one day, I did two meetings in one day. Like, I was, like, hit Seattle, and then I hit, you know, like, Oregon or or whatever. So, yeah, it was a it's a interesting time to to be doing meetups.
[00:07:49] [speaker-1] Yeah. A lot of them, like, they they didn't survive COVID. It's kinda sad. Yeah.
[00:07:55] [speaker-1] Yeah. I'm glad that we kept, Rust NYC going,
[00:07:58] [speaker-1] less frequently during COVID proper, but, like, we kept it going.
[00:08:02] [speaker-0] So to answer your earlier question, I joined Meta, and then you do this team matching thing, or at least at the time, you do this team matching thing. And I ended up just I've heard about that. They they kinda give you you try out a bunch of different groups to see where you would be best placed.
[00:08:16] [speaker-1] Yes.
[00:08:18] [speaker-1] And I had one criteria, which was to join,
[00:08:22] [speaker-1] a a team that used Rust.
[00:08:23] [speaker-1] And so I would just sit there looking at the internal sort of GitHub tool,
[00:08:29] [speaker-1] fabricator,
[00:08:30] [speaker-1] and looking at PRs that touch Rust files and then,
[00:08:35] [speaker-1] looking up the person in the space view tool and being sad because everybody was in the Bay Area or Seattle or whatever. And then one day, I found somebody who was based in New York. I was like, ugh. This is awesome. I sat down next to him. Like, I'm joining your team. And then he was like, you should probably talk to my boss. And so,
[00:08:51] [speaker-1] by doing that, I got on the team, and it was awesome. It was really, really high coding standards, and it was very difficult for a long time. And I was in the middle of onboarding when COVID happened, and I was like, whatever. I'll finish it in a couple weeks. And then I sort of forgot about it. So I realized, like, a year later that I'd gone through some amount of unnecessary pain and struggle as a result of having never completed the onboarding and never really just gotten from
[00:09:16] [speaker-1] other folks on the team like, hey. This is how it works. And Rilla is a fairly complicated framework, so it took a lot of just spelunking,
[00:09:24] [speaker-1] and learning. And I don't think I was
[00:09:27] [speaker-1] I think now I would be much better at doing something like that having done it once. But at the time, it was it was it was a lot.
[00:09:34] [speaker-0] Of course. Yeah. First time you do anything in your tech career,
[00:09:38] [speaker-0] it's just it's it's always so daunting. Like, I remember when I first got my job, you know, it was, like, it was terrifying. Like, I was so worried about every every little thing I I was doing. You know? And now that we got, like, agents, it's it's
[00:09:50] [speaker-0] a you you have so many better resources available to you.
[00:09:54] [speaker-2] Very true. You and even inside a tech company, if you're just, like, working on an like, some sort of a feature app team that's different,
[00:10:01] [speaker-2] but you're working on Relay, which is, like, a platform that's probably used by a bunch of different teams within the company,
[00:10:09] [speaker-2] which is, like, a different kind of experience.
[00:10:11] [speaker-2] And I I I think the way
[00:10:14] [speaker-2] well, I first discovered
[00:10:17] [speaker-2] you and your work through
[00:10:19] [speaker-2] a talk at ReactCon, like reintroducing Relay, which I think was an amazing talk.
[00:10:24] [speaker-2] And that kind of
[00:10:26] [speaker-2] I think the the way that you kind of talked about those concepts, the way you introduced
[00:10:31] [speaker-2] the framework, I think,
[00:10:33] [speaker-2] like, that caught that caught my attention more than the framework itself.
[00:10:37] [speaker-2] And I think over time, the, like, more talks that you have given, I think that's
[00:10:41] [speaker-2] one one of the things that I appreciate a lot about
[00:10:45] [speaker-2] your talks and content,
[00:10:47] [speaker-2] which is, like, just the way that you
[00:10:51] [speaker-2] structure things, the way you explain things. And I think you've put a lot of effort into them as well. So I'm curious when like, how that happened, like, how you kind of got into,
[00:11:03] [speaker-2] I guess, like, may giving a talk about Relay
[00:11:07] [speaker-2] instead of just, like, work like like, writing some code for it. And maybe, like, did you some did you kind of discover that, oh, this is,
[00:11:15] [speaker-2] this is something that I wanna do more?
[00:11:18] [speaker-1] Thanks. I actually really appreciate that. I do try to put an effort into my talks. I think that some
[00:11:25] [speaker-1] people are kind of amazing at giving talks.
[00:11:30] [speaker-1] There's that one guy that comes to mind that does, like, the I
[00:11:34] [speaker-1] don't know if you're the the most famous YouTube guy that does, like, a bunch of really cool things.
[00:11:39] [speaker-1] That really doesn't A pirate gen. No. No. No. I'm not talking about somebody like that. Somebody who does, conference talks from back in the For me, was Rich Hickey.
[00:11:48] [speaker-2] Is that Dylan Mehdi? Guy. He did the art of code?
[00:11:51] [speaker-1] No. No. There's a
[00:11:53] [speaker-1] there was one conference talk about, like, what was, like what was stuff like it was from the perspective of the fifties looking forward. Armstrong.
[00:12:02] [speaker-1] I
[00:12:03] [speaker-1] don't think I'm thinking of him. I'm thinking of somebody else, but I do like, Joe Armstrong, actually.
[00:12:09] [speaker-1] Okay. Whatever. Whatever. There are just some people that have I'm very I'm very curious if you if it comes to you. I I wanna know. Kinda what what it is. What is sidetrack here?
[00:12:18] [speaker-0] Yeah. No. This is great. Yeah. This is the kind of diversions I like because I I love conference talks, and I haven't seen your
[00:12:24] [speaker-0] relay talk, but I'll I'll check it out after the show because Yeah. I've seen a lot I've watched a ton of talks from those conferences specifically,
[00:12:32] [speaker-0] the those React
[00:12:34] [speaker-0] the ReactConf
[00:12:35] [speaker-0] ones. Like, I when I first was getting into all this stuff, I was I was trying to get a sense of, like, what all these tools were. So I was going back. I was watching, like, all these talks, like, you know, you know, Pete Hunt and, like, stuff like that. You know? And that that gave me a ton of context for what was going on and things like React and GraphQL
[00:12:52] [speaker-0] and Relay and, like, what are all these things? How do they fit together? Because, you know, what I've said about the interesting thing about GraphQL is Facebook had this whole stack where they had React and GraphQL and Relay and Flux, like, before Redux. And then all those things were kinda broken apart and introduced to the open source world in a way where it wasn't clear that they were all supposed to be put together. And I feel like that made it really confusing for people if they didn't understand that all these tools were meant to be a certain part of a larger architecture. Architecture.
[00:13:23] [speaker-1] Yeah.
[00:13:27] [speaker-1] Yeah. So I guess to to Deb's question, like, I had been I've been doing presentations for a long time.
[00:13:33] [speaker-1] I remember in fourth grade, like, being a bit of a class clown, like, liking to do that.
[00:13:39] [speaker-1] I did one where I pretended to be
[00:13:43] [speaker-1] that Simpsons character. Hi. I'm Troy McClure, that one,
[00:13:46] [speaker-1] doing something like that. And I remember my parents being like, nobody's gonna get this reference. And I'm like, it's you're not the right age for this. Like, yes, they will.
[00:13:56] [speaker-1] And,
[00:13:57] [speaker-1] yeah, and then I did, speech and debate in high school, and I did
[00:14:01] [speaker-0] Oh, you're a speech and debate kid.
[00:14:03] [speaker-0] Yeah. I had a good friend of the speech national championship.
[00:14:07] [speaker-0] Oh,
[00:14:08] [speaker-0] fantastic. Blake. He went to the two big speech schools, Kentucky and the other one. Okay.
[00:14:17] [speaker-1] But, yeah, I I think, like,
[00:14:20] [speaker-1] conference talks and talks in general. It doesn't even really have to be conference talks. Talks at meetups. Like, there are these super high
[00:14:26] [speaker-1] value
[00:14:27] [speaker-1] artifacts.
[00:14:28] [speaker-1] Right?
[00:14:30] [speaker-1] I think a lot of people should be just putting more effort into them.
[00:14:35] [speaker-1] And I also happen to enjoy it, so maybe it's easy for me to say.
[00:14:41] [speaker-1] And,
[00:14:41] [speaker-1] obviously, like,
[00:14:44] [speaker-1] therefore, I lean into it.
[00:14:47] [speaker-1] But I do like to give good conference talks. I think it's really it it it does
[00:14:53] [speaker-1] allow you to reach a different audience and more people.
[00:14:56] [speaker-1] So for example, at Pinterest, when I interviewed there, sort of everybody,
[00:15:01] [speaker-1] that I interviewed with not everybody maybe, but at least some of the people knew about,
[00:15:06] [speaker-1] some of my side projects and some of the conference talks I had given. And it coincided with I had just gotten into
[00:15:14] [speaker-1] GraphQL Conf.
[00:15:17] [speaker-1] So I was about to,
[00:15:19] [speaker-1] so that was nice. Like, I got to just say, like, hey. I'm about to speak here, which I think makes you look a lot better.
[00:15:24] [speaker-1] Likewise, like, when I said at at Meta, like, somebody in the audience had seen me.
[00:15:29] [speaker-1] So I think that's cool. I think, honestly, like, it's it's worth it for folks to do it. Folks should do more stuff like that.
[00:15:36] [speaker-1] And then
[00:15:38] [speaker-1] in terms of effort, like,
[00:15:40] [speaker-1] I put a lot of effort. This summer, I put in I did three conference talks, and it was too too many. So
[00:15:46] [speaker-1] I would not recommend doing that. I was very overwhelmed for a month and a half
[00:15:51] [speaker-1] because of that.
[00:15:53] [speaker-1] And that's why React Miami was so last minute. You know? I was, like, in my hotel room until literally the moment of.
[00:16:01] [speaker-1] But I would still recommend it
[00:16:04] [speaker-1] because,
[00:16:05] [speaker-1] yeah, you know, it's fun. It's good. It's a great way to meet to meet people. It's a lot easier to meet folks at conferences,
[00:16:11] [speaker-1] if you are a speaker because folks will come up to you or you have something concrete to talk about some talk with somebody about. You don't have to be like, so what kinda stuff are you into? You know? And, like, try to find the overlap. Instead, you can just, say, like, hey. I like your talk about, I don't know, Redux or, you know, TansTack or whatever. And then, of course, if you're giving a talk, you wanna give talk about it, you know, with other folks. I mean, at least most of the time. So, anyway, that's my little spiel. Nice.
[00:16:39] [speaker-2] Yeah. I I always feel like being a regular attendee at a conference is, like, the worst thing to do because, like, it's, like, the worst place to be even as a volunteer.
[00:16:49] [speaker-2] Like, a volunteer usually usually get free tickets to a conference. Like, they don't have to pay and but they still have, like, a I I guess, like, a access to more, I guess, backstage things and a better reason to maybe talk to people. Obviously, as a speaker, you have a lot more,
[00:17:08] [speaker-2] like, a much easier way kind of breaking the ice.
[00:17:11] [speaker-2] But I yeah. I think maybe we can maybe we can talk about conferences forever. We can also talk about
[00:17:17] [speaker-2] GraphQL for a long time. I think we'll circle back to GraphQL
[00:17:21] [speaker-2] Relay and Isograph
[00:17:22] [speaker-2] in the second half. But, yeah, I I'm really interested
[00:17:26] [speaker-2] in hearing
[00:17:28] [speaker-2] what was your, like,
[00:17:30] [speaker-2] early work with AI?
[00:17:32] [speaker-2] What what are the things that you kind of
[00:17:36] [speaker-2] that you were excited about, that you struggled with, and how did you end up at Barnum?
[00:17:43] [speaker-1] Yeah. Yeah. So So I
[00:17:48] [speaker-1] definitely knew about
[00:17:49] [speaker-1] read
[00:17:50] [speaker-1] some echo.
[00:17:52] [speaker-0] It just Is that coming from from my side? It might have been. Yeah. It's gone now.
[00:17:58] [speaker-2] Okay. Go ahead, Robin. I'll put on my earphones. Yeah.
[00:18:03] [speaker-1] Yeah. So
[00:18:04] [speaker-1] I knew about
[00:18:06] [speaker-1] Bitcoin in 2008,
[00:18:07] [speaker-1] and then I looked at it, and I was like, man, the Oracle problem
[00:18:11] [speaker-1] is insurmountable.
[00:18:12] [speaker-1] Like, who's gonna you know? Anyway, so I live with that regret. And then AI, I was very abundantly clear among my friends and I that, like, AI is gonna change the world, like, I don't know,
[00:18:24] [speaker-1] a couple years ago. I don't really know what the timeline is.
[00:18:28] [speaker-1] But then I still, like, was more focused on isograph and just getting very good at,
[00:18:36] [speaker-1] you know, efficiently making code changes manually.
[00:18:39] [speaker-1] And then it really took until this year,
[00:18:42] [speaker-1] which was months
[00:18:44] [speaker-1] after sort of the the winter of everyone using 4.5
[00:18:48] [speaker-1] for all their side projects,
[00:18:51] [speaker-1] which is an eternity.
[00:18:53] [speaker-1] I slipped and I broke my wrist, and so I couldn't type, because I use an external keyboard and, like, it's very thumb heavy, and I just kinda couldn't do it.
[00:19:03] [speaker-1] And
[00:19:04] [speaker-1] I ended up deciding at that point in time, one, to my, wife turned me on to WhisperFlow.
[00:19:10] [speaker-1] And, two,
[00:19:12] [speaker-1] I decided to try to use Cloud Code for everything. So I sort of vibe coded my way into a way to use my computer entirely with one hand. So just kinda like a layer system plus typing plus, like, a custom keyboard layout.
[00:19:25] [speaker-1] And,
[00:19:27] [speaker-1] also,
[00:19:30] [speaker-1] it was really clear from doing that, like, the
[00:19:34] [speaker-1] how much you benefit from infrastructure
[00:19:37] [speaker-1] or from closing the loop, I guess, people call it,
[00:19:40] [speaker-1] and
[00:19:41] [speaker-1] how important
[00:19:43] [speaker-1] that is. Like, I would have just, like, kinda dived in and started working and been able to maintain code quality if I was doing it manually.
[00:19:50] [speaker-1] But, like, very quickly, the AI was just, like, dishing out slop.
[00:19:55] [speaker-1] And I needed to just come up with this custom
[00:19:58] [speaker-1] framework
[00:19:59] [speaker-1] for, right, essentially writing unit tests of,
[00:20:02] [speaker-1] key bindings and stuff like that. I mean, it's not really a custom framework. It was just like really, it was just like explore this state space
[00:20:09] [speaker-1] and make sure that whenever you make a change, it's intentional.
[00:20:12] [speaker-1] And, like, did the AI I mean, it helped the AI, but it would still make these massive changes and not actually review them. So whatever. Okay. So after that,
[00:20:21] [speaker-1] I did what everybody else wanted to do, I think, which is
[00:20:26] [speaker-1] decide that I wanted to build a pipeline
[00:20:28] [speaker-1] where
[00:20:29] [speaker-1] one agent identifies refactors
[00:20:32] [speaker-1] and then a bunch of other agents, maybe in parallel or something, implement them. And, like, the first times I did that, like, it was just kinda bonanza.
[00:20:40] [speaker-1] It was, like, kinda bananas. Like, they would not
[00:20:43] [speaker-1] commit their changes no matter how much I asked. There was, like, one file which was being used to sort of the,
[00:20:50] [speaker-1] just to store everything.
[00:20:52] [speaker-1] And, like, okay. So I had some pretty bad primitives,
[00:20:55] [speaker-1] and, like, it would have been a lot better if I just, like, used a database or something for these tasks,
[00:21:00] [speaker-1] which I did not.
[00:21:01] [speaker-1] But it became very quickly clear to me that what I needed or what I wanted was this,
[00:21:08] [speaker-1] like, a workflow
[00:21:10] [speaker-1] and like a like a DAG.
[00:21:13] [speaker-1] And
[00:21:14] [speaker-1] so I ended up
[00:21:17] [speaker-1] building this sort of, like, this JSON based workflow
[00:21:20] [speaker-1] tool.
[00:21:22] [speaker-1] And at the time, it was
[00:21:24] [speaker-1] it was using a bunch of agents which were long lived that would read from some sort of that would call this binary, and that would give them tasks whenever they were ready to have a task.
[00:21:35] [speaker-1] I didn't really I hadn't worked out how to run claw dash p quite yet.
[00:21:40] [speaker-1] Plus, I think, like I was doing this mostly for work stuff.
[00:21:44] [speaker-1] And
[00:21:45] [speaker-1] we have, like, a interesting setup at work.
[00:21:50] [speaker-1] And
[00:21:51] [speaker-1] running Claude
[00:21:52] [speaker-1] ephemerally like that was not one of the blessed workflows. So at the time, I needed that.
[00:21:57] [speaker-1] This turned into, like, a JSON builder pattern.
[00:22:01] [speaker-1] So I realized that, like, it's just better to build this stuff in TypeScript. You have more type safety. Like, the JSON stuff was very stringly typed.
[00:22:09] [speaker-1] Like, I could enforce the shape. Right? But, like, if you're saying the next step is x, you don't really have any guarantee that x actually exists.
[00:22:16] [speaker-1] So that turned into, essentially, a couple steps further into
[00:22:21] [speaker-1] okay. Now we have this JSON builder pattern, but, like, what what are we actually building? Well, we're building a workflow.
[00:22:27] [speaker-1] Okay. So now instead of building the workflow directly, you're sort of building an I mean, that's basically an AST.
[00:22:33] [speaker-1] And
[00:22:34] [speaker-1] that turned into now we should execute this AST,
[00:22:38] [speaker-1] as if it's actually a programming language,
[00:22:41] [speaker-1] and that ended up being Barnum.
[00:22:43] [speaker-1] So the gist of Barnum is that you have it's a DSL in TypeScript where you write some stuff that hopefully looks like intuitive TypeScript. It looks a little bit like a fact.
[00:22:53] [speaker-1] That generates a
[00:22:55] [speaker-1] an AST that gets serialized and sent to a Rust process where it's executed,
[00:23:00] [speaker-1] or interpreted, I guess, maybe if you're being super
[00:23:04] [speaker-1] persnickety.
[00:23:06] [speaker-1] And
[00:23:07] [speaker-1] on the Rust side, we execute
[00:23:09] [speaker-1] the AST and sort of, like,
[00:23:15] [speaker-1] schedule a bunch of async stuff and and what have you. And one of those async tasks,
[00:23:20] [speaker-1] is
[00:23:21] [speaker-1] invoking an LLM.
[00:23:23] [speaker-1] And so the idea here is that Barnum has,
[00:23:28] [speaker-1] like, has four, I think, goals is how I usually think about it. One is it should be really easy to invoke LLMs from it.
[00:23:35] [speaker-1] That's kinda trivial. I mean, that's true of everything. So the three real ones are one, it should it's kinda high level and focused on control flow,
[00:23:42] [speaker-1] and type safety.
[00:23:44] [speaker-1] Two is that it makes it really easy to
[00:23:49] [speaker-1] handle a parallel work,
[00:23:51] [speaker-1] an asynchronous work.
[00:23:53] [speaker-1] And three,
[00:23:54] [speaker-1] it is really easy for agents to write,
[00:23:57] [speaker-1] because ultimately and I I think if you have those three things, then what you have is the ability to essentially do something similar to code mode,
[00:24:06] [speaker-1] the anthropic thing that I guess was just a couple weeks old now,
[00:24:10] [speaker-1] where
[00:24:10] [speaker-1] the first step is you describe the problem or something like that, and the agent builds a program. And then that program is invoked, and it, in turn, calls a bunch of LLMs.
[00:24:20] [speaker-1] And that is how you get to do several things. One is you constrain the behavior of the LLMs.
[00:24:27] [speaker-1] So, for example, if the LLM if you're just asking LM, hey. One shot this feature, and there's a 100 different sub decisions
[00:24:33] [speaker-1] that you have to make. Like, good luck. It's gonna make bad decisions. It's mostly gonna make lazy and easy decisions rather than, really
[00:24:41] [speaker-1] holding itself to a high bar.
[00:24:43] [speaker-1] And
[00:24:45] [speaker-1] secondly, it's going to be expensive because,
[00:24:49] [speaker-1] it's gonna do stuff like list all the files in the repo. And then, mean, let's say you have a thousand files. Well, that's a thousand files that are now in context, and then it's gonna marshal those into a JSON thing to print out or something like that. Right? Like, that's, like, multiple times that these strings go in and out for no reason. And listing all the files in your repository,
[00:25:08] [speaker-1] it's that's the kind of thing that you should be able to do just using, let's say, JavaScript.
[00:25:17] [speaker-1] So that's the idea behind Barnum. It sort of allows you to constrain
[00:25:20] [speaker-1] the agents, and by doing that, you have more reliability,
[00:25:23] [speaker-1] and they're cheaper because you're not doing stuff that you shouldn't be doing with agents in the agentic world.
[00:25:30] [speaker-1] Awesome.
[00:25:32] [speaker-0] There's one thing that I wanna kind of talk about before we get into actual code examples.
[00:25:37] [speaker-0] Could we, define code mode?
[00:25:40] [speaker-0] Dev, I saw you tweeting about code mode also. I've seen other people talk about code mode.
[00:25:44] [speaker-0] I'm not up on this yet. I'm more of a Codex user than a Cloud Code user. So enlighten me. What is code mode?
[00:25:52] [speaker-1] You wanna take that, Robert? No. You go for it. Be curious for both of your takes. So
[00:25:57] [speaker-2] Okay. The way that I think about code mode is basically that,
[00:26:03] [speaker-2] like, currently,
[00:26:04] [speaker-2] agents call,
[00:26:05] [speaker-2] like, one tool, wait for the result, then they call call the other tool.
[00:26:10] [speaker-2] The the
[00:26:12] [speaker-2] best that the harnesses
[00:26:14] [speaker-2] are doing right now is parallel tools where models will,
[00:26:19] [speaker-2] like, write multiple like, three or four tool calls at once, then wait for all of them to finish and then take the next step.
[00:26:25] [speaker-2] Code mode is bay is essentially a way for a model to write some logic
[00:26:30] [speaker-2] that invokes a bunch of functions
[00:26:35] [speaker-2] at, like basically
[00:26:36] [speaker-2] uses tools
[00:26:38] [speaker-2] as function calls within that script.
[00:26:40] [speaker-2] And then
[00:26:42] [speaker-2] which means it can also combine, like, control flow, loops. It can do, like, basic data transformation inside. So if you have a tool that returns a thousand things,
[00:26:53] [speaker-2] an an LLM can just write, like, okay. Call this function and then do a dot filter and filter out everything that's higher than or that's
[00:27:03] [speaker-2] I don't know. Like, have some predicate, basically. So
[00:27:06] [speaker-2] instead of calling a tool directly, it writes code that will call a bunch of tools. And then one of those functions could be triggering a sub agent. So within that workflow, it can do additional things. And the quest the answer to why
[00:27:19] [speaker-2] is that it's more token efficient.
[00:27:22] [speaker-2] It's it's easier. A lot of tasks
[00:27:25] [speaker-2] are pretty straightforward to, like, put together in a sequence. Like, an LLM doesn't really need to do all the steps individually.
[00:27:31] [speaker-2] It can just orchestrate them and only have to look at the final result.
[00:27:37] [speaker-2] And honestly, the right now, like, I'm a heavy user of Hermes agent right now, and more than half of my Hermes tool calls are Python scripts. And I would love to get replace that with actual code mode.
[00:27:51] [speaker-2] That's my
[00:27:52] [speaker-0] that's my brain dump on code mode. Yeah. So that can fill in what he needs. Robert, what I would be curious then to know is so I I hear a lot of things that overlap there.
[00:28:02] [speaker-0] So
[00:28:03] [speaker-0] what makes code mode different from what you're doing?
[00:28:07] [speaker-1] Yeah.
[00:28:08] [speaker-1] Well, I can I can go and talk about a little bit about the differences? But I think that the key thing to answer the why question
[00:28:14] [speaker-1] is that, like I said earlier,
[00:28:17] [speaker-1] it's that if you are trying to get more reliability
[00:28:21] [speaker-1] out of your LLMs,
[00:28:24] [speaker-1] you don't want the LLM to be responsible for key things. So for example,
[00:28:29] [speaker-1] if your LLM can skip unit tests, can comment out unit tests, or whatever before making PRs and landing PRs,
[00:28:37] [speaker-1] then at some point in time for a sufficiently large task or sufficiently large number of tasks, it's gonna start cutting corners.
[00:28:43] [speaker-1] And on the other hand, it's fairly easy and sometimes really valuable
[00:28:48] [speaker-1] to say, I would not like
[00:28:51] [speaker-1] LMs to skip unit tests. You should never commit something that I didn't do that.
[00:28:56] [speaker-1] Yeah. Yep.
[00:28:58] [speaker-1] And the way that they can not do that is by having the LLM not be the outer layer. So right now, if you're using an agent to do stuff, then the agent is the outer layer, and it can do whatever the hell it wants. Huge advantage is that. It's very flexible. It can kinda, like, adapt and whatever. But on the other hand, if you have a task that you know what you know the outlines of it,
[00:29:20] [speaker-1] and it might be make this change and then run TypeScript, even something like that, doing that as a like, in pro in a programming language means that there's no agent on the outside that could just skip the TypeScript. Like, okay. Maybe the agent could, like, modify the file and then, you know, like,
[00:29:35] [speaker-1] hack the mainframe or what you know I mean? But, like, within
[00:29:39] [speaker-1] realistically,
[00:29:40] [speaker-1] within the kind of stuff that it will do, it will not really,
[00:29:44] [speaker-1] that prevents it from,
[00:29:47] [speaker-1] cutting corners.
[00:29:48] [speaker-1] That's the most important one. Now you may think, ah, that's fine.
[00:29:52] [speaker-1] Working with an agent directly is fine for all the things I want, not all the things I do, and that might be true. It's actually most of the time for writing features,
[00:30:00] [speaker-1] the proper way to you to do the proper thing to do is to work with an agent,
[00:30:04] [speaker-1] because that kinda fits well. And you're reviewing the code at the end of the day or at least kinda sorta looking at it.
[00:30:12] [speaker-1] And if stuff is
[00:30:16] [speaker-0] if you have a human in the loop, then a lot of this stuff is not as high priority or high impact. Because you're verifying it on a step step basis because you're seeing what it gives you. You're like, wait a second. You mess this thing up. You go tell it that. I will say an ad hoc way that I tend to deal with this is I just have an agent review another agent, but, like, not like you just have codex review codex. You have, like, clog code review codex or, like because then it will step outside of the context to actually review it, but that's still then they could cut corners in the review. So that gets me part of the way there, but it's not, like, a real way of solving the problem like you're trying to do.
[00:30:55] [speaker-1] Mhmm.
[00:30:56] [speaker-1] Yeah.
[00:30:58] [speaker-1] And so yeah. So, really, it comes down to, like, what situations do we wanna review remove the human from the loop? Okay. Maybe you're doing some AI work as part of, like, an API,
[00:31:08] [speaker-1] and you're or you're just doing 10,000
[00:31:11] [speaker-1] refactors.
[00:31:12] [speaker-1] Like, those refactors might be converting a file from, I don't know, JavaScript to TypeScript or something like that. Right? Like, kind of annoying to do individually.
[00:31:20] [speaker-1] Maybe there's a little bit of thinking involved.
[00:31:22] [speaker-1] But by and large, like, the task is well,
[00:31:26] [speaker-1] well defined and not open ended. So it's in situations like that where you want to use something like CodeMode,
[00:31:32] [speaker-1] or Barnum. And both CodeMode and Barnum sort of fill a very fill the same niche, I guess, you could say, and they make very different decisions on how to do that.
[00:31:44] [speaker-0] But, yeah, that's that's, I think, the gist. Did we answer this? I don't know if we answered this question directly. Does this only make sense for background tasks? I'm not sure exactly which part of the conversation he's at even asking about here.
[00:31:56] [speaker-1] I think the yeah. Like, well,
[00:31:59] [speaker-1] I guess I think it makes sense if it's an a p if it's something that's, like, there's no human in the loop. Right? That could be a background task. It could be something that's part of an API. It could be,
[00:32:07] [speaker-1] automatically
[00:32:09] [speaker-1] reviewing
[00:32:10] [speaker-1] you know, if you're doing something like reviewing code,
[00:32:13] [speaker-1] in response to an event
[00:32:15] [speaker-1] without any human in the loop. So I think the answer is yes
[00:32:18] [speaker-1] that background tasks fit for this. Not maybe not only for background task, but yeah.
[00:32:23] [speaker-2] I think we can make it much easier to understand
[00:32:26] [speaker-0] with a demo of some sort if you have that set At this point, let's let's get into the actual start looking at some code here. And, also, I like that you said it's a TypeScript DSL because,
[00:32:37] [speaker-0] that was the one thing that going into this, I was like, I'm I don't know any other programming languages, so that will help.
[00:32:44] [speaker-1] Yeah.
[00:32:46] [speaker-1] Actually, yeah. Yeah. I think that that's that's a it's a an on purpose decision.
[00:32:51] [speaker-1] On the one hand, like, English sucks
[00:32:55] [speaker-1] or whatever vernacular you you do sucks because
[00:32:59] [speaker-1] you can't it's not composable.
[00:33:01] [speaker-1] It's not clear what you're referring to. There's no no equivalent of static type checking or anything like that. Like, if you have an extremely well written English language description of a task, you don't know
[00:33:12] [speaker-1] that it is correct, and it is never a 100% correct. You have to run it to see what happens. And even if it runs correctly, you're not a 100% certain that it is correct.
[00:33:22] [speaker-1] And
[00:33:23] [speaker-1] okay. So instead of using English or vernacular,
[00:33:27] [speaker-1] you should,
[00:33:28] [speaker-1] use a programming language.
[00:33:31] [speaker-1] Why not use JavaScript?
[00:33:33] [speaker-1] Well, JavaScript
[00:33:35] [speaker-1] is really is really hard in JavaScript to write correct programs.
[00:33:39] [speaker-1] And in particular, the kind of stuff that you mostly wanna do is it's kind of a DAG like structure a lot of times. And in particular,
[00:33:46] [speaker-1] efficiently going through a DAG of parallel work is something that JavaScript is notoriously poor
[00:33:53] [speaker-1] at a poor fit for. Okay. So why not use a completely different language?
[00:33:58] [speaker-1] Haskell is really good at expressing that. Well, if I told you that you should,
[00:34:02] [speaker-1] you'd be better at writing AI if you wrote Haskell, that might be true, but also very few people would take me up on that offer.
[00:34:10] [speaker-1] So the missing last,
[00:34:12] [speaker-1] the missing
[00:34:13] [speaker-1] fourth option is
[00:34:15] [speaker-1] a
[00:34:16] [speaker-1] DSL inside of TypeScript that gives you different semantics. So it looks more like effect,
[00:34:21] [speaker-1] but it is
[00:34:23] [speaker-1] in the lingua franca.
[00:34:24] [speaker-1] Both the lingua franca are for humans and also lingua franca for AIs.
[00:34:28] [speaker-1] So that's why code mode writes a writes JavaScript, I think.
[00:34:33] [speaker-1] And
[00:34:35] [speaker-1] it's fine,
[00:34:36] [speaker-1] like
[00:34:37] [speaker-1] and it's great because
[00:34:39] [speaker-1] there's a lot of adoption of code mode relative to Barnum.
[00:34:43] [speaker-1] And that's fine,
[00:34:45] [speaker-1] but I still think it's worse because of all the reasons that,
[00:34:49] [speaker-1] that's because it's just basically bare JavaScript.
[00:34:51] [speaker-1] So you might I I, for example, played around with code mode a little bit,
[00:34:55] [speaker-1] and,
[00:34:56] [speaker-1] I asked it to do something that basically had, like, three phases. It would complete phase one entirely, then it would start phase two, then it would do phase three. But, like, sort of the ideal way to do something like that is to imagine that it's a tree and that there's, like, little inputs that go into all the thingies, and you just kinda work on whatever task is available.
[00:35:15] [speaker-1] If you ask the agent to do that, maybe it will do that, but it will not but it doesn't naturally fall into that pit of success.
[00:35:22] [speaker-1] And so you end up with these,
[00:35:25] [speaker-1] you end up with a lower ceiling for the performance,
[00:35:29] [speaker-1] then
[00:35:31] [speaker-1] or rather, it takes more effort to get good performance and stuff like that. And I think the point of AI is that
[00:35:37] [speaker-1] the happy path has to be the performant path if we're gonna start to use it everywhere and really unlock the benefits.
[00:35:45] [speaker-1] Yeah. Okay. So that's that's mostly my responses to Parasocial Fix's questions.
[00:35:51] [speaker-1] That's dope. You wanna start sharing? You for guiding the conversation.
[00:35:56] [speaker-1] Yeah. So No. All good. Yeah.
[00:36:00] [speaker-1] So should I share my screen is what you're saying? Yes.
[00:36:04] [speaker-1] Yeah. Okay. So let's do this.
[00:36:06] [speaker-2] Uh-oh. It's completely fine if the if the demo is
[00:36:10] [speaker-0] if it doesn't properly work first time or if it has You can also show, like, the docs page if we wanna start talking about, like, concepts first.
[00:36:18] [speaker-0] Yeah. Or you can go straight into the into the demo. I need to enable
[00:36:22] [speaker-1] sharing, so I will be back in, hopefully, a matter of minutes. Sure.
[00:36:27] [speaker-0] We got a question here about beads. Have you ever used beads dev? No. It's like some orchestration
[00:36:33] [speaker-0] tool.
[00:36:34] [speaker-0] It gets you a bunch of agents kinda working in in parallel.
[00:36:37] [speaker-0] Beats sounds interesting.
[00:36:39] [speaker-0] I've Mhmm. AirSocial. I've looked into a couple of those orchestration tool that haven't taken the dive on any of them yet,
[00:36:47] [speaker-0] But I feel like that's kinda where a lot of the stuff is going
[00:36:51] [speaker-0] is high level abstractions to get multiple agents kinda doing stuff in concert with each other.
[00:37:02] [speaker-1] Okay.
[00:37:04] [speaker-1] Alright.
[00:37:05] [speaker-1] Y'all see my screen? Excellent. Yes. Yes.
[00:37:08] [speaker-1] Cool.
[00:37:09] [speaker-1] So as you can see here, I haven't actually done a lot of stuff in IceCraft for quite a quite a while, but I created
[00:37:16] [speaker-1] three PRs today. That's what Look at you. So productive. Oh my goodness.
[00:37:22] [speaker-0] And Three red x.
[00:37:24] [speaker-1] Yeah.
[00:37:25] [speaker-1] That's fine.
[00:37:27] [speaker-1] I
[00:37:28] [speaker-1] these are not good PRs.
[00:37:30] [speaker-1] The point is all these PRs did was add a bunch of eprint line comments at the top of of files.
[00:37:38] [speaker-1] And
[00:37:41] [speaker-1] they're actually doing a poor job of this
[00:37:43] [speaker-1] because they didn't I guess I didn't include to
[00:37:46] [speaker-1] reset hard the repository
[00:37:48] [speaker-1] or something like that, and it kind of, like, swallowed a few into it.
[00:37:52] [speaker-1] Or some stuff was running in parallel. Who the hell knows?
[00:37:55] [speaker-1] Yeah. This one only has one file. It's only supposed to modify one file based on the description.
[00:37:59] [speaker-1] Okay. So this is our goal, is to make a bunch of automated refactors.
[00:38:05] [speaker-1] Actually, I'm gonna limit it to one file at a time, because it doesn't really help.
[00:38:09] [speaker-1] It doesn't really help. But, like, this runs in parallel by default.
[00:38:13] [speaker-1] Okay. So I actually do this at work a lot.
[00:38:17] [speaker-1] And
[00:38:19] [speaker-1] one of the things that I've done is
[00:38:22] [speaker-1] I listed
[00:38:24] [speaker-1] something like 26
[00:38:26] [speaker-1] possible refactors that I think are don't change behavior and are good to do almost in every in any file where we can find them. These could be simple. These are things like, I don't like the use of two pipes
[00:38:38] [speaker-1] to,
[00:38:39] [speaker-1] instead of two question marks because two question marks is more clearly saying this is the default value.
[00:38:46] [speaker-1] And so I have one
[00:38:48] [speaker-1] description of a refactor that is that. Other ones are like, hey.
[00:38:53] [speaker-1] There are some impossible states. There are some representable impossible states. Okay. So there's, a a loading Boolean state variable. There's also a,
[00:39:02] [speaker-1] a nullable
[00:39:04] [speaker-1] promise value
[00:39:05] [speaker-1] variable that's in state and an error. You know, and you can't have all three you can't have error and the okay value,
[00:39:12] [speaker-0] at the same time. Hey. Quick question. So are all 26 of these ones you came up with yourself, or did you do an analysis also with the AI to help find them?
[00:39:21] [speaker-1] I think I just mostly pick the ones that I care about.
[00:39:25] [speaker-0] So you went through your you and actually wrote these all out to then direct it to what to do. It's both.
[00:39:31] [speaker-1] One, I described them, and then I had the AI turn that into descriptions of the refactors to do, and then I would sort of read them and go back. I think the key thing to note is that
[00:39:45] [speaker-1] you you wanna bootstrap what you're doing.
[00:39:49] [speaker-1] You don't really want to write the code yourself if the if the code is code bug. Like, instead, you just go back and forth in AI, and then that will, like, expand that out until, like, exactly the thing that runs, and you sort of examine it. And you're like, hey. You made a bug here, whatever, and then you sort of go from there. Same thing is true of Barnum. Same thing is true of writing these,
[00:40:06] [speaker-1] refactors that we're gonna we're gonna do.
[00:40:09] [speaker-1] But, yeah, there's, like, 26 refactors
[00:40:11] [speaker-1] ranging from really small to actually pretty big changes
[00:40:14] [speaker-1] to ones that sort of involve looking at many files at once. So, for example,
[00:40:19] [speaker-1] is every single prop that we have for every component, like, actually passed somewhere?
[00:40:25] [speaker-1] And if not, can it be are are are all the possible values passed?
[00:40:29] [speaker-1] So are all the variants passed? So, for example, we might accept a string, but it can only be
[00:40:35] [speaker-1] two possible concrete values. One of the refactors will change that to the type will make the type only those concrete values.
[00:40:41] [speaker-1] Okay. But, like, the point is I've done that,
[00:40:44] [speaker-1] and I've, that way, shipped hundreds. I'm not exaggerating here. I've shipped hundreds of PRs that just do that, and they have never,
[00:40:52] [speaker-1] as far as I know,
[00:40:54] [speaker-1] broken
[00:40:55] [speaker-1] anything except for in one particular case where TypeScript was lying. And then I sort of updated the refactors to handle that case.
[00:41:05] [speaker-1] And
[00:41:06] [speaker-1] yeah. So
[00:41:08] [speaker-0] This is super this is super interesting to me because I've been,
[00:41:12] [speaker-0] on this contract for the last, like, seven months now, and I'm working for a very large, payroll company to basically, like, teach their developers how to use AI coding tools. And I do a two week,
[00:41:24] [speaker-0] workshop for them, and, like,
[00:41:27] [speaker-0] three quarters of it is based just around refactors and, like, finding refactors and making refactors and doing exactly what you're talking about.
[00:41:34] [speaker-0] So and I think and I've been doing that a lot on my own projects.
[00:41:38] [speaker-0] So when I first heard you when I first read the description, it says, like, you know, this project is for, like, shipping hundreds of PRs a week or something like that. I think most people in their mind, they think, you know, like, a 100 feature PRs. You know, they don't necessarily think, like, there's a 100 refactor PRs.
[00:41:54] [speaker-0] And so I think the first question would be, like, why would you need to make that many refactors?
[00:42:00] [speaker-1] The code base is large,
[00:42:03] [speaker-1] and there's a lot to improve in the code base. Like, I think that there's actually
[00:42:09] [speaker-1] so, yes, most people think about using AI to to ship new features. And I think this is a poor fit for
[00:42:15] [speaker-1] using AI to ship new features. Well, at least, like, the refactor part of it.
[00:42:19] [speaker-1] Because
[00:42:22] [speaker-1] you're not doing the same task repeatedly if you're shipping new features. It's more like you're kind of ideating and figuring out what's the best architecture for this human in the loop. Whereas what you're looking at, you're finding the space in which it can do a lot of this work independently
[00:42:37] [speaker-0] of a human having to constantly because if you had to check every one of these refactors, that's just completely
[00:42:42] [speaker-0] out of the question.
[00:42:43] [speaker-1] Yes.
[00:42:45] [speaker-1] And so I still use it for, like,
[00:42:48] [speaker-1] making changes when I, when I have a human in the loop. So for example,
[00:42:53] [speaker-1] I actually did I had, like, 60 stacked PRs. It's sixty, seventy, or something like that,
[00:42:58] [speaker-1] to refactor one of our main surfaces.
[00:43:01] [speaker-1] And, basically, I wanted to break it up into smaller parts and do all the things that you would expect to to do in a
[00:43:07] [speaker-1] in a general cleanup of this thing. But that was very human driven. But in the end, like, I had sexy 60 whatever sacked PRs,
[00:43:14] [speaker-1] and I ended up using Barnum, the the second half of what I'll show you,
[00:43:18] [speaker-1] to babysit those PRs, rebase them until they pass,
[00:43:22] [speaker-1] and
[00:43:25] [speaker-1] rerun the failed
[00:43:26] [speaker-1] things that are flaky
[00:43:28] [speaker-1] and then essentially land them as needed. And that was cool because, like, that's actually I'll I'll talk about that later. But I think that the key thing the cool thing about that is that
[00:43:40] [speaker-1] it's a convenient way to write it, and you'll look at the logic that's in the the babysitting thing. And you'll see that, yeah, that, like, all of that stuff kinda makes sense. Like, you do need to categorize the PR, and then you do need to do one or the others. And, like, writing that in English, like, it won't be done reliably.
[00:43:57] [speaker-1] And I did try to get LLMs to rebase PRs and land them for me, and, like, half the time, it would just get confused about what the diff is and be like, hey. This this PR is empty. Like, let me just close it. And then I was like, I'm not paying attention, so I wouldn't notice, but some changes just wouldn't land.
[00:44:13] [speaker-1] And that
[00:44:14] [speaker-1] that's silly. Like, LMs are bad at a lot of stuff. They're great at some things, but they're also bad at being doing the thing that you need them to get right,
[00:44:22] [speaker-1] reliably.
[00:44:25] [speaker-1] Yeah. So okay. So there's two aspects of Barnum that I wanna show you. One is the generating the PRs, and then one is the babysitting.
[00:44:32] [speaker-1] And then there's I'm not gonna show you the babysitting in in
[00:44:36] [speaker-1] actually, I'll just I'll look at the code, but we won't we won't see it doing the rebasing because All good. Yeah. Whatever. There's no the open source, there's no CI,
[00:44:45] [speaker-1] basically.
[00:44:45] [speaker-1] As long as tests pass, I can merge them, and I usually merge straight to master.
[00:44:49] [speaker-1] Okay. Cool. So let's take a look.
[00:44:52] [speaker-1] So
[00:44:54] [speaker-0] You can continue on. I'm gonna just hop off screen for one minute to go free fill my drink, but I'll be listening.
[00:44:59] [speaker-1] Cool.
[00:45:01] [speaker-1] Okay. So here's Barnum. Barnum-circus.github.io.
[00:45:05] [speaker-1] For folks who wanna check it out, would definitely recommend it.
[00:45:09] [speaker-1] The nice part about this is that there is a quick start.
[00:45:13] [speaker-1] And if you just point the LM at this quick start and sort of tell it what to tell it that it you want it to do that, it does a decent job of of writing,
[00:45:23] [speaker-1] a refactor. And that's how I built,
[00:45:25] [speaker-1] I mean, a Barnum workflow, and that's how I built most of these.
[00:45:29] [speaker-1] Okay. So what does it feel like to write Barnum? Well, basically,
[00:45:34] [speaker-1] you are doing something like this. Oh, this is actually
[00:45:38] [speaker-1] hopefully, the current docs are are up to date because I want to be using the latest.
[00:45:45] [speaker-1] Yeah. This is what it looks like.
[00:45:48] [speaker-1] So, for example, you call list files dot iterate. For each of those, you migrate a component, and then you collect it, and then you run it. And this
[00:45:57] [speaker-1] and what will this do?
[00:45:59] [speaker-1] List files here
[00:46:01] [speaker-1] is something that returns an array. We're gonna iterate on that, and then we're gonna call migrate component.
[00:46:06] [speaker-1] That is something that takes an item in the array, and it's all fully statically type checked.
[00:46:10] [speaker-1] What actually happens here?
[00:46:12] [speaker-1] This
[00:46:13] [speaker-1] generates
[00:46:14] [speaker-1] a description of a program, an AST,
[00:46:17] [speaker-1] that gets serialized, sent to this Rust process.
[00:46:20] [speaker-1] That Rust process sort of executes it maximally, parallelly.
[00:46:24] [speaker-1] So this is a parallel iteration, for example.
[00:46:27] [speaker-1] And then
[00:46:30] [speaker-1] it finishes, and that value is sent is serialized back to JavaScript.
[00:46:34] [speaker-1] And,
[00:46:35] [speaker-1] when we await this value,
[00:46:37] [speaker-1] we will,
[00:46:39] [speaker-1] we'll get the the result of doing that.
[00:46:42] [speaker-1] And then you sort of run this JavaScript
[00:46:45] [speaker-1] like you normally would,
[00:46:46] [speaker-1] and it kinda does the right thing. Okay. So what is list files here or migrate component? What is migrate component?
[00:46:52] [speaker-1] Well, migrate component here
[00:46:53] [speaker-1] is
[00:46:54] [speaker-1] a handler.
[00:46:55] [speaker-1] So handlers here
[00:46:57] [speaker-1] are essentially just
[00:46:59] [speaker-1] chunks of code that can do whatever they want.
[00:47:03] [speaker-1] In this case,
[00:47:04] [speaker-1] it,
[00:47:05] [speaker-1] I mean, it doesn't really do anything. It logs something,
[00:47:09] [speaker-1] and it says that it didn't migrate it. It's, like, kind of a useless kind of a useless little stub. But the point is you can do whatever you want here.
[00:47:16] [speaker-1] You can read the file. You can call Claude.
[00:47:19] [speaker-1] You can invoke codex, whatever.
[00:47:23] [speaker-1] And so
[00:47:25] [speaker-1] Barnum
[00:47:26] [speaker-1] essentially allows you to glue a bunch of things like this together
[00:47:31] [speaker-1] and do what you actually want to do. So let's take a look at
[00:47:37] [speaker-1] Ref 2, which is what I call the refactory,
[00:47:40] [speaker-1] and take a look at process.
[00:47:42] [speaker-0] Do you increase
[00:47:44] [speaker-0] your font by just one or two? Absolutely.
[00:47:46] [speaker-1] I can. That's great. Yeah. I am blind as a bat too, and I appreciate
[00:47:51] [speaker-1] it larger than that even for myself.
[00:47:54] [speaker-1] Okay. So, for example, we might call extraction consumer.
[00:47:58] [speaker-1] Extraction consumer here is going to,
[00:48:01] [speaker-1] it's gonna loop, and it's gonna find these refactors,
[00:48:04] [speaker-1] and then it's going to put them in a queue.
[00:48:07] [speaker-1] And,
[00:48:08] [speaker-1] let me actually
[00:48:11] [speaker-1] dive into
[00:48:12] [speaker-1] what this actually looks like when I run it. So if we take a look at ghost t.
[00:48:18] [speaker-1] Okay. So first thing I'm gonna do is I'm gonna clear the state out of this thingy,
[00:48:21] [speaker-1] and then we're gonna run it. Your your font on your terminal now? Yes. Yes. Yes. Yes. Yes. Yes.
[00:48:27] [speaker-1] Okay.
[00:48:28] [speaker-1] And now I'm gonna run it. So I'm just gonna invoke some sort of JavaScript,
[00:48:31] [speaker-1] and this happens to end up invoking the pipeline. But, like, there's, like you know, it's whatever. It's a CLI. It does some other stuff.
[00:48:38] [speaker-1] And I point it to this re these refactors, and this is literally how I use it at work and also, how I'm gonna demonstrate it here. And we're gonna run it.
[00:48:47] [speaker-1] And what is this gonna do? It's gonna reset the queues.
[00:48:51] [speaker-1] All this logging, I'm just doing myself. It's just calling functions.
[00:48:55] [speaker-1] And then Barnum sort of
[00:48:58] [speaker-1] queues them together.
[00:49:01] [speaker-1] And when it gets going, I'm not sure why it's taking slightly longer, it's going to start invoking,
[00:49:07] [speaker-1] LMs.
[00:49:08] [speaker-1] And one of the things that it's gonna do is, for example,
[00:49:13] [speaker-1] well, I'm just sort of very verbosely logging
[00:49:16] [speaker-1] the heck out of all this stuff. And you'll see that, like, one of the things that LLM said is, hey. The refactor has been successfully applied.
[00:49:23] [speaker-1] All seven print line statements have been inserted and blah blah blah.
[00:49:27] [speaker-1] Okay. Cool. So it's actually doing that.
[00:49:29] [speaker-0] So So it's logging back its its own chat responses.
[00:49:33] [speaker-0] Yeah. Exact I just happened to do that. So Yeah. Nothing about this really if you if you were vibe coding this project itself, you would want those logs to be fed back into your agent that is creating the the project itself. Yeah.
[00:49:46] [speaker-1] So, really, all I'm doing is let me see. It's called dash p, maybe. Is that what you're supposed to do with Claude?
[00:49:52] [speaker-1] Is it Claude dash p? Is that what we do? Yeah. Here we go. For programmatic access. Yeah. Yeah.
[00:49:58] [speaker-1] I'm literally just doing this. I'm writing some sort of file, and then I'm executing that file. And that file happens to contain claw dash p. Okay. When I execute this,
[00:50:10] [speaker-0] I take a look at the this and, you know, the the output, and then I stream it to to standard out. So it's, nothing not really anything special. It's a CLI. Like, you you build a CLI. Yeah. Just Yeah. This is great. This is everything I'm building right now, the AI is exactly like what you're doing right now. It's exactly the type of type of crap I'm building, which is the CLI pipe and all this different stuff together. You know? Yep.
[00:50:33] [speaker-1] Okay. So I don't actually usually log this amount of verbosity because it's kinda ridiculous. But, like, the point is it does a bunch of stuff, and then eventually,
[00:50:41] [speaker-1] this will finish. This is sort of the the extraction part. Wait. No. This is implement now.
[00:50:46] [speaker-1] So now it finished extracting the refactor, and then it will implement it.
[00:50:50] [speaker-1] And cool. It created a draft PR here, and let's take a look at this.
[00:50:56] [speaker-0] So this is Can you explain what you mean?
[00:50:59] [speaker-0] Sorry. Go ahead. I was gonna say, so does this have, like, a GitHub token or, like, you haven't given permissions? Like, how is it connecting to,
[00:51:07] [speaker-0] or I guess Cloud Code is just doing that.
[00:51:09] [speaker-1] Cloud Code is just well, no. I'm just calling GitHub or GHPR
[00:51:14] [speaker-1] create or whatever, essentially, in both the system. The GitHub CLI also. Probably. Probably. Yeah. Yeah. Great.
[00:51:21] [speaker-1] I say probably because, again, everything is sort of bootstrapped together with me and the agent working together. Yeah. So excellent work. It created a perfect PR doing exactly what I wanted it to do. It's very, very impressive.
[00:51:35] [speaker-2] So, actually, let's take a look. Dev before we continue on. Yeah. Sorry. Yeah. I was just wondering. What what do you mean when you said extract or refactor before implementing it?
[00:51:46] [speaker-1] Sorry.
[00:51:47] [speaker-1] That is why is this not,
[00:51:52] [speaker-1] the
[00:51:53] [speaker-1] what I mean is that there's
[00:51:55] [speaker-1] one process
[00:51:57] [speaker-1] that loops over a bunch of input files.
[00:51:59] [speaker-1] So we have these input files. There's only one here in this input. Normally, I would have every single file in the repository.
[00:52:05] [speaker-1] There's one process, one thing that loops over each of these files, analyzes them for potential refactors.
[00:52:12] [speaker-1] So in this case, this is the refactor.
[00:52:14] [speaker-1] I don't know how to do word wrap.
[00:52:18] [speaker-1] No. It's not there.
[00:52:20] [speaker-1] But, like, you know, it
[00:52:23] [speaker-1] it says add eprint line. The and and I basically send this to Claude, and then I have a whole bunch of stuff around it. So, for example,
[00:52:32] [speaker-1] at work, I don't actually know what what happens here. This was this was Vibe adopted,
[00:52:38] [speaker-1] in order to work with Isograph. Like, at work, I have a bunch of stuff that it attempts to run. So, for example, make sure that TypeScript passes, make sure that
[00:52:46] [speaker-1] Lint passes, and so on and so forth.
[00:52:48] [speaker-1] And then there's other agents that will rereview it to make sure that nothing is in a broken state or we didn't do any we didn't cut any corners and stuff like that.
[00:52:58] [speaker-1] But I'm being a little bit vague here. Right? Because the point is, like, it's a programming language to do whatever the hell you want, and I just happen to be doing that. But the I think that the
[00:53:08] [speaker-1] bigger point is, like, what actually does it feel like to do this?
[00:53:12] [speaker-0] Oh, okay. So let's see. Reference. No. So I wasn't seeing, these comments in the chat. I think we kind of answered this. Does how do you actually drive the LLM?
[00:53:20] [speaker-0] You're doing it via the CLI agent, not via the API.
[00:53:24] [speaker-0] Yeah. But you say it's called soft wrap instead.
[00:53:29] [speaker-1] Oh, I think I'm looking at I might be looking at an old version. It's okay. Okay. Soft wrap. Thank you. Thank you. Oh, wonderful. I just started using zed
[00:53:39] [speaker-1] and go CTI on
[00:53:41] [speaker-1] I figured it's time to to up upgrade.
[00:53:45] [speaker-1] But, yeah, essentially, what I'm doing is this.
[00:53:47] [speaker-1] When I run the CLI with process, right, like or when I run it, I'm running this, And this calls run pipeline.
[00:53:54] [speaker-1] I think this is this is outdated. It should just be not run.
[00:53:58] [speaker-1] But I might be on an old version.
[00:54:01] [speaker-1] I guess I probably just haven't pushed the latest. The minutiae is not super duper important. Fair. Fair. Fair. Fair. Okay. So and then this will run this thing, and then it will run
[00:54:11] [speaker-1] this thing, which is the second thing here. And this one,
[00:54:16] [speaker-1] will run these in parallel.
[00:54:18] [speaker-1] And
[00:54:19] [speaker-1] the extraction consumer and the implementation consumer are what we were just talking about earlier. So in particular, the extraction consumer
[00:54:29] [speaker-1] will
[00:54:30] [speaker-1] loop.
[00:54:32] [speaker-1] It will dequeue a file from the,
[00:54:36] [speaker-1] from the queue.
[00:54:37] [speaker-1] And if it finds a file,
[00:54:40] [speaker-1] it will run this some branch. If it doesn't, it will just sleep, and then it will,
[00:54:45] [speaker-1] it will recur.
[00:54:47] [speaker-1] But it probably shouldn't.
[00:54:50] [speaker-1] Because if you're done with files, you're done with files.
[00:54:53] [speaker-0] So I think that that's like we probably don't need to have this hour loop, but this is a loop. So I was gonna ask about the loop. So because I was talking about loops right now in the AI world. So is this leading into that loop based workflow, or is this such an incidental loop? This is not super important.
[00:55:10] [speaker-1] I have opinions on how loops are done. Like, loops are a very simple primitive, and it's it's bananas to me that
[00:55:20] [speaker-1] Claude is like, hey. You can run stuff in a loop,
[00:55:23] [speaker-1] and it's this amazing feature. When we have programming languages that have loops, they have many types of loops.
[00:55:30] [speaker-1] They have loops of conditions.
[00:55:33] [speaker-1] It's just kinda weird that we're, like, doing that.
[00:55:37] [speaker-1] That, like, loop and goal are these, like, amazing
[00:55:40] [speaker-1] primitives. Like, this is silly.
[00:55:42] [speaker-1] Like, programming languages are just better ways of expressing that.
[00:55:46] [speaker-1] And
[00:55:47] [speaker-1] if
[00:55:48] [speaker-1] that allows you to corral
[00:55:51] [speaker-1] the logic that the LLMs are doing into sort of, like, subparts,
[00:55:55] [speaker-1] and thus get more reliability and so on and so forth. They just don't need this stuff in LLMs.
[00:56:01] [speaker-1] Anyway, so that's I I think that that's my overall opinion here is that this is a better way to write things. Okay. So what do we do? DQ file.
[00:56:10] [speaker-1] Okay. Nice. GD does go to definition. That's not that bad.
[00:56:14] [speaker-1] It's a handler, like we just described, which is say it just does some arbitrary stuff.
[00:56:20] [speaker-1] And in this case, it probably looks at the list, like, some folder of files and it kinda uses that as a queue.
[00:56:27] [speaker-1] And then if we find one,
[00:56:30] [speaker-1] then,
[00:56:32] [speaker-1] yeah. You know, I'm pretty sure I have an updated version of all this stuff that looks better. And I so,
[00:56:39] [speaker-1] this whole time, I'm gonna be trying not to talk about how I accidentally
[00:56:43] [speaker-1] You wanna taste it. Version. No. It's fine. It's fine. It's fine. No. No. It's fine. It's fine.
[00:56:51] [speaker-1] Okay.
[00:56:52] [speaker-1] So
[00:56:55] [speaker-1] and now we're just sort of, like, describing
[00:56:58] [speaker-1] some sort of workflow. So we get this claimed file.
[00:57:02] [speaker-1] It's a reference to essentially,
[00:57:04] [speaker-1] something that has this shape. We don't ever get this shape in JavaScript. This is, like, all on the Rust side. And the Rust side will call this kind of stuff, and it will
[00:57:14] [speaker-1] do this. And then, eventually, we'll loop over each of the refactors,
[00:57:18] [speaker-1] and we will essentially call
[00:57:24] [speaker-1] this thing,
[00:57:26] [speaker-1] and this will sorry. I'm gonna make this slightly smaller because I'm very bothered by the there we go. Okay. At least at least it kinda looks a little nicer now. Is that still big enough for folks? That's perfect. Yeah. That's good. Okay. Cool. Yeah.
[00:57:39] [speaker-1] So it'll bind this, and then what do we do? We'll call extract refactors
[00:57:44] [speaker-1] and extract refactors.
[00:57:46] [speaker-1] What does it do? Well, it reads the file, and then it calls Claude, and it expects some sort of array value back. But that's not really what's important. What's important is that,
[00:57:57] [speaker-1] it this thingy
[00:57:59] [speaker-1] will make sure that you have
[00:58:02] [speaker-1] that Claude returns
[00:58:04] [speaker-1] this schema of
[00:58:07] [speaker-1] That's Zod. Some sort of JSON that returns this Zod's that upholds this Zod's schema.
[00:58:12] [speaker-1] And so okay. So that's gonna be something I refactor name, what locations to change, a change summary,
[00:58:18] [speaker-1] motivation,
[00:58:19] [speaker-1] guarantee. I don't even know if, like, this is necessary.
[00:58:21] [speaker-1] It's like, maybe just these would be necessary, but whatever. It's all vibe coded, and it works. That's the important part.
[00:58:29] [speaker-1] And, okay, references.
[00:58:31] [speaker-1] Find all references. G shift a.
[00:58:35] [speaker-1] This is, like, weird.
[00:58:38] [speaker-2] I'm still learning You can just have your Versus code key binds instead if that's what you're more familiar with. Yes. I have I have a lot of custom key binds.
[00:58:47] [speaker-1] Okay. You know what? I I'm I'm already lost. Okay. So we extract the refactors. Right? And that gives us an array of items.
[00:58:55] [speaker-1] Right? And then we're going to,
[00:58:58] [speaker-1] call advance or finish.
[00:59:01] [speaker-1] So
[00:59:02] [speaker-1] this is another handler, and I think it seemed to have changed something rather somewhere because now everything's
[00:59:07] [speaker-0] let me just try undoing things. Like, it's a relatively small amount of code for the overall project. Yes.
[00:59:18] [speaker-1] And the point is okay. So,
[00:59:21] [speaker-1] I mean, I could continue running through this, but, like, it's not really, like, particularly interesting code. It, like, does what you expect.
[00:59:27] [speaker-1] Conceptually,
[00:59:28] [speaker-1] we have a list of files. We have a list of refactors. We create a cross product for those. For each of those, we run an agent to say, like, hey. Please
[00:59:36] [speaker-1] read this file and tell me whether this refactor
[00:59:39] [speaker-1] exists or whether any number of these refactors exist in this file. If so,
[00:59:46] [speaker-1] generate a, essentially, an in a set of instructions.
[00:59:50] [speaker-1] And then somewhere later,
[00:59:53] [speaker-1] this will advance or finish, blah blah blah, and then we will get to,
[00:59:57] [speaker-1] let me find
[00:59:59] [speaker-0] Okay. So I'm
[01:00:00] [speaker-0] totally with you on on all of this. My one big question right now is you've mentioned that it looks at a single file for these refactors.
[01:00:08] [speaker-0] That seems like it would be fairly limiting then in terms of the overall types of refactors you could do?
[01:00:17] [speaker-1] It focuses on one refactor one file at a time, but it it's an agent. It can do sort of whatever it wants. So it it will need other files. Bunch of files all at the same time.
[01:00:28] [speaker-1] I
[01:00:29] [speaker-0] maybe I even I guess I just look at it this way. Like, the common to refactor you might see would be, like, a overly long file that needs to be broken up into, like, five modules, you know, something like that. So is that the type of thing it could do, or that is just a Oh, it can. It can. Yeah. Yeah. Great. That's yeah. That was that was my big confused part here. But I think one other I
[01:00:49] [speaker-2] think one other example to maybe
[01:00:51] [speaker-2] put what explain what what maybe Anthony was trying to say is, let's say I have a file
[01:00:57] [speaker-2] where and it imports, like, three other files.
[01:00:59] [speaker-2] And to determine if if a certain refactor is needed, I also need to go and look at the those three other files.
[01:01:06] [speaker-2] But I might also have other maybe I have other agents looking at those files as well.
[01:01:11] [speaker-2] So
[01:01:13] [speaker-2] I I guess, again, because you're just calling Claude here, you can tell you can
[01:01:18] [speaker-2] you just prompt Claude, like, and ask it, hey. Does this file need this refactor?
[01:01:23] [speaker-2] And
[01:01:24] [speaker-2] Claude is yeah. Claude has the read tool, which means it's
[01:01:28] [speaker-2] it sees the file, and then it can go ahead and read other files from the code base, and it can easily figure out
[01:01:35] [speaker-2] that, hey. This is this is needed or this is not needed, basically.
[01:01:39] [speaker-2] Yes. Was
[01:01:41] [speaker-0] right. Yeah. And then and then my follow on question from that is that what are what are its heuristics in terms of what requires a refactor versus not? Because it's slightly subjective thing.
[01:01:53] [speaker-2] Yeah. I think though that those things would be, like, things that you explain
[01:01:58] [speaker-0] in your refactoring description. Like, the these are these are the decisions. Right. Because you're starting by explaining what the refactor has to be in the first place so it doesn't have to Right. Make that decision. Gotcha.
[01:02:08] [speaker-1] Mhmm. Yeah. Exactly. It's just like
[01:02:11] [speaker-1] in in in
[01:02:13] [speaker-1] practice,
[01:02:14] [speaker-1] these extraction instructions that I have,
[01:02:16] [speaker-1] are sometimes really short. Like, the question mark the the two pipes to double question mark, pretty simple.
[01:02:24] [speaker-1] It's like,
[01:02:25] [speaker-1] change it always.
[01:02:27] [speaker-1] Make sure it doesn't change any behavior.
[01:02:29] [speaker-1] If the left side is a string that could be empty, like, be careful, whatever, that kind of stuff.
[01:02:34] [speaker-1] And
[01:02:35] [speaker-1] other ones are, like, multiple pages
[01:02:37] [speaker-1] of descriptions.
[01:02:40] [speaker-1] So for example, I have some that essentially adopt the Relay migration API, which is kind of akin to adopting Relay. And that's like it's
[01:02:49] [speaker-1] essay
[01:02:50] [speaker-1] multiple essays worth of, like, here is the correct pattern. Here's the and if I could break that up into smaller parts,
[01:02:57] [speaker-1] I think it would have been worth it. But, like, right now, I think the best way to use Barm in its current state
[01:03:04] [speaker-1] ends up being
[01:03:05] [speaker-1] a very detailed description of exactly the refactor that needs to happen.
[01:03:10] [speaker-0] Yeah.
[01:03:11] [speaker-0] I'm also getting this makes sense. These refactors are not just simplifying
[01:03:15] [speaker-0] your code base. They are, like like, you're talking about bringing on Graph versus not, which, like, that's a different type of refactor from, like, I'm trying to cut down on tech debt. You know? Yep. Exactly.
[01:03:26] [speaker-2] One one example that I'm working on right now is, like, I'm trying to migrate a bunch of solid j's prod projects to solid two point o, and there's, like, a bunch of RFCs that actually.
[01:03:37] [speaker-2] Exactly. Yeah. Because the some of them are, like, simple enough. Like, you just rename
[01:03:43] [speaker-2] a function, and it mostly does the same thing.
[01:03:47] [speaker-2] But some like, there might be some few cases where just renaming the function is not enough and you need to do additional things. And there there's a few APIs that have completely changed.
[01:03:59] [speaker-2] And so the some of them have, like, a really comp complicated decision tree almost, and you have to look at a bunch of files.
[01:04:06] [speaker-2] So, obviously, if I take all of these RFCs,
[01:04:09] [speaker-2] dump it into a single cloud session, and say go and refactor this app, I I don't expect that to work in a million years. Maybe Mitos can figure that out. Tried that. It you're correct. It didn't work.
[01:04:21] [speaker-2] Exactly. Yeah. But
[01:04:23] [speaker-2] what and this is kind of what I eventually landed on was that
[01:04:27] [speaker-2] take, like, a bunch of individual
[01:04:30] [speaker-2] refactors that need to happen and kind of explain, like, different scenarios in detail
[01:04:35] [speaker-2] and then split them across different cloud sessions or different, like, LLM sessions. Like, okay. I I am going to run one session
[01:04:43] [speaker-2] that just goes and look at looks at all the create effect usage and just marks the ones that need to be migrated or that need to
[01:04:52] [speaker-2] like, how did how they need to be migrated and then have a different
[01:04:56] [speaker-2] a different session that then goes in again and actually does the refactors.
[01:05:01] [speaker-2] So there's, like, a lot of different
[01:05:04] [speaker-2] kind of optimizations that you're doing. The first is that you're only you're giving agents a very specific task
[01:05:11] [speaker-2] of, like, looking for one
[01:05:13] [speaker-2] kind of refactor or one kind of pattern.
[01:05:16] [speaker-2] And then the other thing is you're kinda splitting the concerns of identifying an implementation
[01:05:21] [speaker-2] because if you have the same
[01:05:24] [speaker-2] the agent that goes and identifies refactors is gonna have a lot of files in its context that don't need to be refactored because it it's like, its job is to filter them out.
[01:05:34] [speaker-2] So the agent that goes ahead and implements them,
[01:05:37] [speaker-2] it's not gonna have any of that in context, and it's gonna and and I think the the thing that we know about LLMs is that the the
[01:05:45] [speaker-2] the less of the less context we use, the more performance
[01:05:49] [speaker-2] or, like, the more correctness we are we can get out of them.
[01:05:54] [speaker-2] And, obviously, like, cost, like, instead of, like, a two two hundred thousand token sessions,
[01:06:00] [speaker-2] you can be done like, you're
[01:06:02] [speaker-2] you you you're probably are gonna have, like, a hundred, two hundred agent sessions. But if all of them are, like, within 50 k tokens,
[01:06:10] [speaker-2] then it's probably much cheaper than,
[01:06:13] [speaker-2] like, letting letting
[01:06:15] [speaker-2] Claude go or keep going on a task and compacting and then go hits 200 again, compacts, hit two two hundred k again, which is
[01:06:23] [speaker-2] the worst way of looping, but that's the only way of looping that people have kind of been advertising so far because the people who are advertising looping
[01:06:31] [speaker-2] are model providers.
[01:06:34] [speaker-1] Yes.
[01:06:36] [speaker-1] Actually, that's that's a really good point. I I missed that earlier, when I was talking about the litany advantages
[01:06:42] [speaker-1] is that because you can essentially tailor
[01:06:44] [speaker-1] the invocation of Claude to something very narrow, it's literally read this one file and tell me whether this applies
[01:06:51] [speaker-1] and return something with the following JSON shape. Like, that's as, like, minimal one, it's it's very
[01:06:58] [speaker-1] it's a good use of an agent because,
[01:07:02] [speaker-1] the agent will
[01:07:07] [speaker-1] code mods, stuff like that, kinda difficult to use for something more complicated. Okay. Adding, like, an eprint line in the beginning of every function, like, yeah, we could do that with a code mod. But, like, anything more complicated than this, then an agent is the perfect thing for it, but you also want to use it,
[01:07:22] [speaker-1] in as narrow and tailored way as possible.
[01:07:27] [speaker-0] This is the only in Paris Social, like, she said a while back was remember Codemods,
[01:07:31] [speaker-0] a whole industry that just died because of LLMs.
[01:07:34] [speaker-0] Yeah. Remember code mods were a big thing for Redwood because
[01:07:37] [speaker-0] we would
[01:07:38] [speaker-0] always wanna create a very smooth upgrade pass where we give all these code mods to upgrade your stuff, but it's just very complicated.
[01:07:50] [speaker-1] Yeah. So to answer your question earlier, so we can basically do whatever we want. And if we wanted to just read the one file,
[01:07:55] [speaker-1] well, then, you know, just change the allowed tools that you pass in. And, again, like, this is not some this is not some magic API. It's just something I wrote, which ends up invoking Claude, and you can sort of do it however you want. But what's nice about this extraction is it can't
[01:08:09] [speaker-1] write any files. It can't do other stuff, at least potentially. I don't really know whether
[01:08:15] [speaker-1] I I think it will not do other stuff, at least hopefully.
[01:08:19] [speaker-1] So that's kinda cool.
[01:08:23] [speaker-1] Okay. So we extract the refactors,
[01:08:26] [speaker-1] and then what we do is we
[01:08:28] [speaker-1] put them in another queue, and then we call this implementation consumer.
[01:08:32] [speaker-1] And that does sort of the the reverse of that. It reads from that queue and implements and generates a PR.
[01:08:38] [speaker-1] And that's sort of more of the same.
[01:08:42] [speaker-1] And
[01:08:43] [speaker-1] the I think the more interesting thing to look at is actually just this babysit
[01:08:48] [speaker-1] thing.
[01:08:49] [speaker-1] So, for example, again, hoping that this is yeah. This is good.
[01:08:54] [speaker-1] At some point in time, we need to
[01:08:58] [speaker-1] process one PR.
[01:09:00] [speaker-1] Let me see where this is. How do I
[01:09:04] [speaker-1] yeah. Okay. Cool.
[01:09:06] [speaker-1] And that is cap is that that is called right after categorized PR.
[01:09:11] [speaker-1] So categorized PR
[01:09:14] [speaker-1] will it's essentially a handler that returns some sort of,
[01:09:19] [speaker-1] man. I don't know how to
[01:09:22] [speaker-1] I I still don't know how to go
[01:09:24] [speaker-1] to definition. I didn't work, though.
[01:09:26] [speaker-1] So we have this PR category schema. Right? Okay. So it's
[01:09:30] [speaker-1] the PR is gonna be categorized in one of five things.
[01:09:36] [speaker-1] Bypass automation. Okay. If I need to force land it for some reason
[01:09:41] [speaker-1] or it has been force landed,
[01:09:43] [speaker-1] it needs to be retargeted because force landed. With
[01:09:48] [speaker-1] internally at at Pinterest, we have some tags that you can use to force to to skip CI. Okay. The point is, like, that that's not that doesn't matter. Force. Yeah. Yeah.
[01:09:58] [speaker-1] Exactly.
[01:09:59] [speaker-1] Okay.
[01:10:00] [speaker-1] These are the ones that are more applicable. Okay. So maybe this is a stack of PRs,
[01:10:04] [speaker-1] and now this PR doesn't point at master. It points at a a branch that's either landed
[01:10:09] [speaker-1] or has been
[01:10:11] [speaker-1] abandoned,
[01:10:12] [speaker-1] so we need to retarget it. We need to rebase it and then change the PR to target master.
[01:10:17] [speaker-1] Needs rebase.
[01:10:18] [speaker-1] Okay. There's more than one commit in this branch,
[01:10:21] [speaker-1] and we need to rebase it. So the parent commit has landed and been deleted.
[01:10:27] [speaker-1] Some sort of checks are failing, or it's ready to merge, or some sort of checks are still pending. So there's, like, canonical things to do. Right?
[01:10:36] [speaker-1] And what do we call it? Categorize here.
[01:10:40] [speaker-1] So what do we do when we categorize PR? Well, okay. I mean, it's it's the kind of thing that you would
[01:10:46] [speaker-1] expect. It's just some JavaScript function that's in a handler, and it does whatever you want. You know? Like, it it does things,
[01:10:53] [speaker-1] and it returns values, and it checks as it there con conflicts, in which case it needs a rebase and and whatever.
[01:11:00] [speaker-1] Anyway, the actual stuff here is not super interesting.
[01:11:05] [speaker-1] What only matters is that
[01:11:09] [speaker-1] let me if I could find it, hopefully. I don't really know how to I guess I could look for references.
[01:11:16] [speaker-1] Find all references.
[01:11:19] [speaker-1] Oh, no. It's create handler. I didn't want that. I wanted to categorize PR.
[01:11:26] [speaker-1] Okay. So here,
[01:11:29] [speaker-1] and then we ultimately call process one PR. Right? So does categorized PR call
[01:11:35] [speaker-2] an agent at any point, or is it all just procedural code?
[01:11:40] [speaker-1] I think that one probably doesn't invoke an agent.
[01:11:43] [speaker-2] Right.
[01:11:44] [speaker-2] Okay. So it's also a good shake a showcase of, like,
[01:11:48] [speaker-2] a lot of times you can take a lot of work out of the agent's
[01:11:51] [speaker-2] kind of plate
[01:11:52] [speaker-2] Yes. When you can just, like if it's simple enough and you can express it deterministically,
[01:11:57] [speaker-2] then
[01:11:58] [speaker-2] why the hell not? Like, why would you give an agent a task? So,
[01:12:02] [speaker-0] obviously, you you want to do that if you can.
[01:12:05] [speaker-1] Yes.
[01:12:07] [speaker-1] And then we process one PR,
[01:12:10] [speaker-1] and,
[01:12:12] [speaker-1] this has this fixed
[01:12:14] [speaker-1] fixed failing
[01:12:15] [speaker-1] checks pipeline.
[01:12:18] [speaker-1] And that
[01:12:19] [speaker-1] does,
[01:12:20] [speaker-1] that invokes an agent.
[01:12:22] [speaker-1] That will essentially look at what checks have failed,
[01:12:27] [speaker-1] preload those into context, maybe,
[01:12:29] [speaker-1] and then tell the agent, hey. Here's what happened. Please fix it. And then,
[01:12:34] [speaker-1] actually, we might as well go to the definition of that. So what is this gonna do? It's gonna check out the branch. It's gonna run fixes.
[01:12:41] [speaker-1] And if it passed
[01:12:45] [speaker-1] okay. Actually, I do have a retry loop. I'm really on an old version of code right now for some reason.
[01:12:51] [speaker-1] That's fine.
[01:12:53] [speaker-1] This actually just loops several some number of times and then retries. And what's nice about this is that there's actually
[01:13:00] [speaker-1] that's the kind of thing that you want control over. I limit the number of retry attempts to something like three
[01:13:06] [speaker-1] because if they have failed three times in a row,
[01:13:10] [speaker-1] it's probably
[01:13:11] [speaker-1] something is not gonna be solved by throwing more tokens at it.
[01:13:16] [speaker-1] And the PR gets in this, like, sort of parked state,
[01:13:19] [speaker-1] where the agent just stops trying to fix it. And, otherwise, it will commit and push the branch, and that, as you might expect,
[01:13:27] [speaker-1] just does a bunch of stuff in, like, you know, sort of deterministic land.
[01:13:33] [speaker-1] But, yeah, the the reason I wanted to talk about that, about, like, babysit was,
[01:13:39] [speaker-1] exactly like Dev said, like,
[01:13:41] [speaker-1] the more you can move into the deterministic world, the better. And, also, to just simply point out that
[01:13:48] [speaker-1] categorizing a PR into those five things and handling each of those distinctly
[01:13:53] [speaker-1] would be a nightmare to express in English.
[01:13:57] [speaker-1] And
[01:14:00] [speaker-1] on the other hand, it's actually quite nice and easy to express in what sort of amounts to a functional language,
[01:14:07] [speaker-1] And that is a huge improvement. And then but then you want somewhere inside of this to and be able to invoke an LLM.
[01:14:14] [speaker-1] So the more the moral of the story is that the outside should be a programming language,
[01:14:19] [speaker-1] and that invokes LMs on the inside. And those should be as
[01:14:25] [speaker-1] simple and as light as possible.
[01:14:30] [speaker-2] Yeah. Makes sense. Bottom.
[01:14:32] [speaker-2] Yeah. Oftentimes with agents, like, there there
[01:14:36] [speaker-2] there are conversations about, like, inner loop and outer loop.
[01:14:39] [speaker-2] And, yeah, the what what you're trying to say here is that a lot of times
[01:14:43] [speaker-2] humans are the outer loop. If I'm using Codex or Claw directly, I am the outer loop. Every time the agent does something and stops, I have to look at it and then go and trigger another session,
[01:14:55] [speaker-2] which, like, basically, I am the bottleneck of how of how much work is happening, how many tokens I'm spending.
[01:15:05] [speaker-2] Yeah. You're not sorry. If
[01:15:08] [speaker-2] yeah. But if that outer loop is something you can orchestrate, you can loop, and you can keep, like, run over and over again,
[01:15:16] [speaker-2] It
[01:15:17] [speaker-2] it gives you, like, a higher level primitive to define what kind of work you wanna do.
[01:15:23] [speaker-2] I I think this is kind of what
[01:15:26] [speaker-2] Boris was talking about when he said that he doesn't write prompts anymore. He writes loops.
[01:15:31] [speaker-2] But I think what people miss is that pro like, a part of the loop is writing the prompt itself. So writing a loop doesn't mean you're not writing prompts anymore.
[01:15:40] [speaker-2] It's just that you're writing prompts in a very different way
[01:15:44] [speaker-2] where they describe a very specific
[01:15:47] [speaker-2] small amount, like a unit of work instead of, like, a high level go and do this thing.
[01:15:55] [speaker-1] Yes. I think that's exactly right. Like,
[01:16:02] [speaker-1] yeah. It's like we wanna describe these workflows.
[01:16:05] [speaker-1] Describing them with English is not gonna get us to the reliability where you can actually remove humans. But, ultimately, what we're doing is describing these workflows.
[01:16:14] [speaker-1] And I think that, like, people call that building loops, which is kind of silly. But
[01:16:21] [speaker-1] yeah.
[01:16:24] [speaker-2] Yeah. I think yeah. One one one thing that I would love to get maybe if some of your thoughts on is, like, I saw somewhere a while ago that,
[01:16:35] [speaker-2] like, agent orchestration
[01:16:36] [speaker-2] is gonna become like a concur concurrency problem.
[01:16:39] [speaker-2] And I think this was kind of obvious in some of your some of these workflows when there were there was, like, a a queue and you have to acquire a file. Because if you have a bunch of things running in parallel on the same code base, it's basically like running multithreaded programs with shared memory.
[01:16:59] [speaker-2] Like, there are a lot of similarities.
[01:17:01] [speaker-2] This is why work trees are are an important concept because
[01:17:06] [speaker-2] it's it's basically like for, like, forking or forking memory
[01:17:11] [speaker-2] so that different threads can I I I actually don't know too much about concurrent,
[01:17:17] [speaker-2] like, multi threaded programming and how that works? I'm more of a, like, just
[01:17:22] [speaker-2] have every thread just have its own little piece of state and then serialize messages back and forth, like, kind of the Erlang model.
[01:17:30] [speaker-2] But what I saw a decent bit of environment was, like, there's a queue,
[01:17:34] [speaker-2] and you have to acquire resources.
[01:17:37] [speaker-2] And
[01:17:38] [speaker-2] so how like, what what does that kind of look like? Like, how often are you doing WorkTrees? Where are you implementing WorkTrees? I think that that also becomes,
[01:17:49] [speaker-2] a thing. Like, how many WorkTrees do you have at at the same time for any project?
[01:17:55] [speaker-2] Yeah.
[01:17:56] [speaker-1] Yeah.
[01:17:57] [speaker-1] So everything is sort of done in user land. Like, Barton provides some, like, low level primitives.
[01:18:02] [speaker-1] Mhmm. But, like, it doesn't have a strong opinion on on this sort of things. However, you're right that, like, in practice, you do want to
[01:18:11] [speaker-1] well, actually, it has a strong opinion that sort of everything happens maximally in parallel.
[01:18:16] [speaker-1] And so that means that, like, if you are trying to do a bunch of refactors at once, well, each thing needs its own
[01:18:23] [speaker-1] its own work tree,
[01:18:25] [speaker-1] or you need some way of limiting the number of refactors that are in flight at a time so that each one has a work tree that is available.
[01:18:34] [speaker-1] And,
[01:18:35] [speaker-1] yeah, I guess I don't have, like, a super deep answer here. I mean, there are some stuff within Barnum of how we do, like, parallelism on the Rust side.
[01:18:45] [speaker-1] But, like, you're absolutely right that,
[01:18:48] [speaker-1] essentially,
[01:18:51] [speaker-1] everything is a parallel
[01:18:53] [speaker-1] everything's ultimately a parallel problem.
[01:18:55] [speaker-1] And
[01:18:57] [speaker-1] I think the the Bartum
[01:18:59] [speaker-1] model makes sense here, which is sort of because everything is maximally parallel, what that means is that any work that is available to be done is being done. And it's up to you
[01:19:10] [speaker-1] to have
[01:19:11] [speaker-1] the chain the have the code that will essentially not proceed
[01:19:15] [speaker-1] and do more work if there are not enough resources to do that work.
[01:19:19] [speaker-1] So
[01:19:21] [speaker-1] do you wanna run,
[01:19:22] [speaker-1] like, more than five Claude codes
[01:19:25] [speaker-1] even if invoked with dash p at once? Probably not. So there probably should be some sort of,
[01:19:32] [speaker-1] primitive that you have that, like, gives you access to a Claude code,
[01:19:36] [speaker-1] and limits that to five.
[01:19:39] [speaker-1] And Bartum could do a little bit better there.
[01:19:43] [speaker-1] Right now,
[01:19:44] [speaker-1] you're I'm sort of doing that in user land by essentially limiting
[01:19:48] [speaker-1] their
[01:19:49] [speaker-1] limiting it to sort of two agents in parallel that generate the refactors
[01:19:54] [speaker-1] and some larger number of agents that, like, implement them.
[01:19:57] [speaker-1] But in practice, the the bottleneck is not that. The bottleneck is, like, rebasing and landing. And, like, our CI
[01:20:07] [speaker-1] was not prepared was not built to handle this sudden onslaught of hundreds and hundreds of PRs.
[01:20:14] [speaker-1] So I'm not super concerned about making Barnum
[01:20:17] [speaker-1] as,
[01:20:18] [speaker-1] like, making this workflow as performant as it possibly could be in theory.
[01:20:24] [speaker-1] So,
[01:20:25] [speaker-1] and then there's another reason that I'm not, like, super concerned about
[01:20:29] [speaker-1] that. I think that the parallelism is important. I think correctness is important. But in the end, like, what are we doing? We're invoking processes that invoke LLMs,
[01:20:37] [speaker-1] and an LLM can take minutes at a time. So, like, if you have,
[01:20:41] [speaker-1] so the important thing is running stuff in parallel. It's not like saving it's not shaving milliseconds off of the invocation path.
[01:20:50] [speaker-1] Yeah. I mean, there's cool stuff I do on the Rust side. But in in in the Barnum workflow land, it's sort of you just do whatever you want. And I happen to have some patterns that I think work well,
[01:21:02] [speaker-1] but I don't have all of the answers quite figured out yet. Like, this works for what I'm doing with it at Pinterest,
[01:21:09] [speaker-1] and
[01:21:10] [speaker-1] I should probably make it more usable in, like, a variety of other work a variety of other circumstances.
[01:21:16] [speaker-1] But, like, in the end, like, it it works well for what I'm doing. So
[01:21:21] [speaker-2] Yeah. Makes sense. And you you won't know what works what patterns work for other use cases until people actually start using it for those use cases.
[01:21:29] [speaker-2] So a low low level primitives make sense until patterns emerge and you find certain things that can be built into the language that, okay. Now here's a way to do the to do something that everyone wants to do in terms of Yes. Per was gonna ask you where the framework was going to go. So you guys literally just answered that before I could even ask it. So that's great.
[01:21:53] [speaker-0] I do wanna make sure we have time for some of the isograph thing. So
[01:21:58] [speaker-0] I had just a couple kind of wrap up questions before we go on to that.
[01:22:03] [speaker-0] It seems like this would be fairly portable
[01:22:05] [speaker-0] if you were to do, like, codex programmatically,
[01:22:09] [speaker-0] open code programmatically. There's nothing really about Claude code that this is tied to right now. Is that correct? Exactly. Exactly.
[01:22:17] [speaker-0] Cool. That's then that's dope. So do you have you experimented with those, or for you, Claude code is working just fine? You you don't feel the need to to try the other ones?
[01:22:26] [speaker-1] Claude code is working fine.
[01:22:29] [speaker-1] Yeah. I mostly
[01:22:30] [speaker-1] once I got it working with Claude, I wasn't super interested in for,
[01:22:34] [speaker-1] just for fun
[01:22:36] [speaker-1] figuring out how to make it work with Codex, but it should just be the same. Right? It's just invoking some process,
[01:22:41] [speaker-1] invoking it, and then enforcing that the LLM
[01:22:46] [speaker-1] responds with some JSON that we can extract from some long stream of text.
[01:22:51] [speaker-1] Mhmm.
[01:22:53] [speaker-1] Yeah. And, also, like, I think to add on to where is where is Barnum going,
[01:22:59] [speaker-1] there's
[01:23:00] [speaker-1] a few other things that I wanted to that I wanna achieve with Barnum. For one thing, like and and this actually gets at why I think,
[01:23:07] [speaker-1] code mode is not ideal
[01:23:09] [speaker-1] is not ideally designed. The way code mode works
[01:23:12] [speaker-1] is that
[01:23:14] [speaker-1] if something crashes and you reinvoke it, then you replay everything. So you have this one file that, let's say, loops over a thousand files,
[01:23:22] [speaker-1] does some work, and then processes it. Okay? So we we did 999
[01:23:27] [speaker-1] files, and we failed to process the thousand file.
[01:23:30] [speaker-1] That is gonna replay everything. So it's going to reinvoke the LLMs, except it's not actually gonna invoke the LLM. It's just gonna, like, pass the data in, and it's gonna pass it back. And then the JavaScript is gonna do extra work, and it's gonna do other stuff,
[01:23:41] [speaker-1] which is good. But it and that gives us the advantage that the code that you write in code mode just looks like plain old JavaScript.
[01:23:50] [speaker-1] But it has the disadvantage that
[01:23:54] [speaker-1] everything that touches the outside world has to go through an LLM. So earlier, we're talking about listing all the files in your repo.
[01:24:02] [speaker-1] If you if that goes through an LLM, man, like, you're just burning context. Like, that costs money to list all the files in your repo in order to, I don't know, find all the JavaScript files. You can't do that with Codebug, which is kind of bonkers to me.
[01:24:16] [speaker-1] And secondly,
[01:24:18] [speaker-1] if you are doing a lot of work on the JavaScript side, for example, you list all the files in your repo and you filter them down, every time you replay,
[01:24:25] [speaker-1] you have to redo that work. And so that also means that the JavaScript has to be,
[01:24:31] [speaker-1] not idempotent. It has to be pure.
[01:24:34] [speaker-1] So no access no so, obviously, you can't access the file system. That's why I asked with the LM.
[01:24:39] [speaker-1] Two,
[01:24:41] [speaker-1] you can't use stuff like math dot random. You can't use stuff like new date and so on and so forth. But, like, if you're using some external library and it happens to use math dot random as part of one of its algorithms where it does some logging, like, it's gonna just randomly break,
[01:24:55] [speaker-1] and that's not good. So code mode, like, it makes these decisions, which are I think make it easier to adopt
[01:25:03] [speaker-1] at the expense of being the correct model.
[01:25:07] [speaker-1] Okay. So what does that have to do with the future of IceGraph of of Barnum? Excuse me. IceGraph is my other project for folks on the call. Yeah. We're about to get into. Yeah. Yeah.
[01:25:18] [speaker-1] Thing, it describes
[01:25:19] [speaker-1] a workflow, but it is not actually executed on the JavaScript side. So it is a data structure that is,
[01:25:26] [speaker-1] introspectable,
[01:25:28] [speaker-1] and it will
[01:25:31] [speaker-1] be executed by TypeScript.
[01:25:33] [speaker-1] But that also means that every single stage in this execution,
[01:25:38] [speaker-1] we know how I mean, we know what it is. So if you stop
[01:25:41] [speaker-1] in the middle of a Barnum execution
[01:25:44] [speaker-1] and then you restart,
[01:25:45] [speaker-1] we have all of the information
[01:25:48] [speaker-1] to restart from exactly where you left off. Maybe this assess worthiness
[01:25:53] [speaker-1] was in flight. Okay. We'll have to reinvoke that. But that's small and hopefully
[01:25:58] [speaker-1] contained. It's not like this it's not necessarily a massive thing. And you could if you reinvoke it, hopefully, it does the correct thing.
[01:26:07] [speaker-1] I don't have this in this version of of GARM. Earlier versions had this, and then I did a refactor, and then I didn't choose to bring it back quite yet. But the idea is that you want this to be
[01:26:18] [speaker-1] automatically serializable,
[01:26:19] [speaker-1] automatically resumable.
[01:26:21] [speaker-1] And in that sense
[01:26:24] [speaker-1] yeah. Okay. So that's one thing that I want, that I think is gonna be that is pretty important to actually being able to use this,
[01:26:30] [speaker-1] for a larger variety of use cases.
[01:26:33] [speaker-2] One quick thing I would add there is that crashing crashing,
[01:26:36] [speaker-2] yeah, that's definitely a a big use case. But a bigger use case for this sort of, like, pause and resume is just human in the loop because sometimes a workflow, like, halfway in needs an approval from a user. And if I'm away, if from my computer, I might not see that for, like, another day or so. So the the next day I come back and I approve it, it should I want it to start from right there.
[01:26:58] [speaker-1] Yes. That's a good point. And right now, you would do that by just having a loop that sort of pulls,
[01:27:03] [speaker-1] which is fine,
[01:27:04] [speaker-1] but also maybe not the most ideal way to do this compared to just, like, short circuiting and and sort of,
[01:27:11] [speaker-1] waiting for some input.
[01:27:15] [speaker-1] Yeah. And then the other thing is that all of these I didn't actually mention this earlier, but the key thing about these handlers is that they're exported JavaScript functions,
[01:27:23] [speaker-1] and they each run-in their own process,
[01:27:26] [speaker-1] in an isolated process.
[01:27:30] [speaker-1] Okay. That's nice because now they can't interact with each other. Sort of everything is sort of as
[01:27:36] [speaker-1] enclosed as possible. And so that specifically means for this case, like, well, we can just reinvoke that function if we happen to crash while assess worthiness
[01:27:45] [speaker-1] is,
[01:27:46] [speaker-1] Jesus.
[01:27:47] [speaker-1] I I have to figure out how to disable that garbage.
[01:27:53] [speaker-1] And in particular
[01:27:55] [speaker-1] well,
[01:27:56] [speaker-1] the way we invoke those is from the Rust side. We invoke a process that calls node or calls PNPM or calls whatever,
[01:28:04] [speaker-1] and executes
[01:28:06] [speaker-1] that little,
[01:28:08] [speaker-1] that JavaScript.
[01:28:09] [speaker-1] And, okay, that sounds
[01:28:11] [speaker-1] what's special about JavaScript? Nothing. So we could also allow you to invoke Python,
[01:28:16] [speaker-1] Bash,
[01:28:17] [speaker-1] whatever custom
[01:28:22] [speaker-1] runtime for invoking Claude or something like that sort of more directly as part of this. Yes. Exactly.
[01:28:28] [speaker-1] Yeah.
[01:28:29] [speaker-1] So in particular, it sounds super useful for doing stuff like orchestrating your your Python,
[01:28:34] [speaker-1] like your ML workflow
[01:28:36] [speaker-1] in a way that is accessible to folks that are more used to,
[01:28:41] [speaker-1] JavaScript.
[01:28:42] [speaker-1] Or I mean, there's also nothing special about this. Like, all we're doing here is some light transformation,
[01:28:47] [speaker-1] generating an AST,
[01:28:50] [speaker-1] and then serializing that and sending it to the Rust side where the real work happens. Like, this is actually super simple.
[01:28:57] [speaker-1] Let's take a look. Do I have Barnum?
[01:29:03] [speaker-1] If I have let's see. Barnum here.
[01:29:10] [speaker-1] Let's see. If we have this
[01:29:12] [speaker-1] constant
[01:29:16] [speaker-1] Oh, that's that's not a JavaScript file.
[01:29:19] [speaker-1] Those are markdown.
[01:29:21] [speaker-1] Okay. I think I can go to definition here.
[01:29:27] [speaker-1] Yeah. See? It's really simple. It's just Zed dev.
[01:29:33] [speaker-1] I'm very new to zed, as you can tell.
[01:29:36] [speaker-1] So this, like, this constant function,
[01:29:39] [speaker-1] which just happens to be one of the things you can do,
[01:29:42] [speaker-1] it
[01:29:43] [speaker-1] it just returns some AST thing. Then And that gets generated into some sort of tree that gets composed and whatever and sent serialized and sent to the Rust side.
[01:29:52] [speaker-1] Nothing about this is specific to JavaScript.
[01:29:55] [speaker-1] So we could just as easily have
[01:29:58] [speaker-1] a DSL in type in Python, a DSL in whatever your language of choice is, in Ruby even,
[01:30:05] [speaker-1] and it would work just as well.
[01:30:07] [speaker-2] Or a completely custom detail.
[01:30:09] [speaker-1] Yep.
[01:30:11] [speaker-1] Actually, do want custom stuff. That's that's one of the things I do want ultimately. But, you know, you gotta be you gotta be,
[01:30:19] [speaker-1] you gotta pick your battles. You know? So
[01:30:22] [speaker-0] Use your your technical innovation tokens or points. Someone someone had a term for that. And then we should only, like, bet on one big new piece of tech per project. If you bet on too many, like, you you use your innovation tokens, I think, is what they called it. Mhmm. Yeah. I never follow that. I always like, every time I have a new project,
[01:30:43] [speaker-0] I pick, like, three to four new things that I wanna play around with, and I We got a question here. And then after that, do you wanna go to the isograph stuff to keep us on track? So I don't get why we need AST step. Why do we need Rust? It could just be running inside TSS node. And while you do that, I'm gonna just to use the bathroom real quick. So
[01:31:02] [speaker-1] Yeah.
[01:31:04] [speaker-1] So the reason we want to use Rust is that Rust is
[01:31:10] [speaker-1] it makes it easy to actually write code that is more correct
[01:31:15] [speaker-1] and more trustworthy.
[01:31:18] [speaker-1] And
[01:31:20] [speaker-1] there's sort of, like, two aspects to this. On the one hand, there is
[01:31:25] [speaker-1] this layer here
[01:31:27] [speaker-1] where this is invoked
[01:31:29] [speaker-1] sort of to construct the AST,
[01:31:32] [speaker-1] and then these handlers are construct are run-in separate processes, and then there's something in between.
[01:31:38] [speaker-1] We could, in theory,
[01:31:40] [speaker-1] just do this entirely in JavaScript.
[01:31:43] [speaker-1] But I think if we did this entirely in JavaScript without at least having an intervening layer that called a bunch of processes in their own a bunch of, like, handlers in their own process,
[01:31:55] [speaker-1] well, then everything could sort of reach out and,
[01:31:59] [speaker-1] have whatever side effects you want they want. And if you have whatever side effects you want, then you kinda struggle
[01:32:06] [speaker-1] to
[01:32:09] [speaker-1] to
[01:32:10] [speaker-1] have the guarantees that everything is actually correct in the way that you want.
[01:32:15] [speaker-1] But that being said, obviously, Rust and JavaScript and everything else, it's Turing complete, and you can sort of do whatever you want in whatever language.
[01:32:23] [speaker-1] So I think the most important part here is that there is
[01:32:30] [speaker-1] one, it's I I like Rust. I think it's a great language. And two, the the
[01:32:34] [speaker-1] disconnect between the runtime and the invoked handlers and the isolation of the handlers is
[01:32:40] [speaker-1] somewhat important.
[01:32:43] [speaker-1] At least in theory, that's important. Yeah.
[01:32:46] [speaker-2] So Yeah. Yeah. I think
[01:32:49] [speaker-2] that makes sense. I think the
[01:32:50] [speaker-2] focus of the question was probably not on, like, why Rust,
[01:32:54] [speaker-2] but more on, like, why does there need to be an intermediate step? Like, why do you need a step that constructs the AST then another another another step that
[01:33:04] [speaker-2] interprets or executes that AST and then calls out to the these external processes
[01:33:09] [speaker-2] rather than
[01:33:11] [speaker-2] the workflow itself being a rust or a typescript function that gets executed
[01:33:16] [speaker-2] dynamically.
[01:33:18] [speaker-2] And yeah. So you're
[01:33:20] [speaker-2] saying that the isolation between
[01:33:22] [speaker-2] the orchestration and the handling
[01:33:25] [speaker-2] is important. And I I think one of the reasons why that's important is the pause and resume thing that you mentioned earlier. Like, you cannot you just cannot do that in vanilla TypeScript unless
[01:33:36] [speaker-2] you introduce, like,
[01:33:38] [speaker-2] I guess, more more
[01:33:40] [speaker-2] syntax of some sort or, like, use workflow, use step that where cell has, and then you add a custom compiler there. But you can't
[01:33:49] [speaker-2] yeah. I think
[01:33:51] [speaker-2] that's, like, one of the reasons, but, yeah, that's
[01:33:55] [speaker-1] a uh-huh. Yeah. Yeah. That's that's right. I think the isolation
[01:33:58] [speaker-1] is not easy to well, yeah, you need the isolation for exactly for the resumability
[01:34:02] [speaker-1] and just for ease of reasoning.
[01:34:05] [speaker-1] Mhmm.
[01:34:06] [speaker-1] And because
[01:34:11] [speaker-1] yeah. I mean, that that's basically for that. I mean, you also get some other benefits from the isolation. Like, you can have higher order functions really easily. So, like, retry this thing three times. That's a really easy thing to do, and it sort of wraps whatever you want.
[01:34:23] [speaker-1] And it doesn't necessarily know anything about what's happening on the inside.
[01:34:28] [speaker-1] It's kinda nice. But, yeah, I mean, the real answer is, like, I like Rust. I think that,
[01:34:32] [speaker-1] this is
[01:34:34] [speaker-1] a
[01:34:35] [speaker-1] it's a pleasant way for me to ship a lot of code in a small amount of time.
[01:34:40] [speaker-1] With respect to temporal, this is also really similar to temporal.
[01:34:44] [speaker-1] I think it has better,
[01:34:46] [speaker-1] some better properties than temporal. For example, I
[01:34:51] [speaker-1] think composability in temporal
[01:34:54] [speaker-1] is not very good. I think it's really hard to do stuff like,
[01:34:59] [speaker-1] have higher order functions,
[01:35:01] [speaker-1] retry things, and have the actual, behavior that I want. So in particular, this loop thing here, this gives us a function recur. And whenever recur is encountered,
[01:35:11] [speaker-1] well, it has a a return type of never.
[01:35:14] [speaker-1] Whenever it's executed, well, then we tear down this AST,
[01:35:18] [speaker-1] and we
[01:35:19] [speaker-1] re execute this AST.
[01:35:21] [speaker-1] In this case and so we
[01:35:24] [speaker-1] dequeue another file at that point in time.
[01:35:27] [speaker-1] So recur also occurs here. And so if I, for example, like, move this up, well, then, I mean, it still continues to work. And I can pass recur to some sort of, like,
[01:35:36] [speaker-1] wait five you know, sleep
[01:35:40] [speaker-1] then. Right? Recur. And that will just work. Like, recur is just a value that gets passed somewhere else
[01:35:47] [speaker-1] and so on and so forth.
[01:35:49] [speaker-1] All these kind of things, like, I can do because I was
[01:35:54] [speaker-1] because I I made a very specific deliberate choice, and I think that many of these other libraries,
[01:35:59] [speaker-1] temporal, they have more users because what they're doing is more approachable, but it limits the ceiling.
[01:36:06] [speaker-1] And I'm not necessarily building a business out of Barnum,
[01:36:09] [speaker-1] so I'm okay with temporal also, like, a whole platform. Like, it's not just a library. Right? Yeah. Yeah. And that's probably where the money's at. It's, like, doing the
[01:36:18] [speaker-1] doing the
[01:36:20] [speaker-1] the replayable work.
[01:36:22] [speaker-1] I don't even remember what the term is.
[01:36:25] [speaker-1] Durable execution. Like, durable.
[01:36:28] [speaker-1] Yeah. Yeah. I
[01:36:29] [speaker-0] only know about this because Swix worked at this company for, like, a year. And so I used to always listen to every interview Swicks would ever do. So I heard him talk about Tim for, like, a whole year, and I'm like, this is solving a problem I do not have.
[01:36:41] [speaker-0] Yeah.
[01:36:47] [speaker-1] But yeah. So that's part of my I do hope folks try it. Yeah. Very, very cool. I will definitely try it out
[01:36:54] [speaker-0] because I got lots of refactors I always wanna do.
[01:36:58] [speaker-0] Let's get into isograph a little bit. I looked at the docs, and I'm like, I see GraphQL queries,
[01:37:05] [speaker-0] and it's being fed into some sort of React like component syntax.
[01:37:11] [speaker-0] And that's pretty much all I need. Like, I'm sold.
[01:37:14] [speaker-0] Nice.
[01:37:15] [speaker-0] There's nothing about this that would confuse me because this, to me, is just how all programs should be written forever.
[01:37:22] [speaker-1] Yeah.
[01:37:26] [speaker-1] So
[01:37:28] [speaker-1] IsoGraph
[01:37:29] [speaker-1] I guess, like, let's let's take a quick detour,
[01:37:33] [speaker-1] talk about GraphQL.
[01:37:35] [speaker-1] What is nice about GraphQL?
[01:37:37] [speaker-1] What's nice about GraphQL is that you have,
[01:37:41] [speaker-1] a few things, is that you have fragment like compose you have composability.
[01:37:45] [speaker-1] So you might have, like, a home page or a user detail fragment.
[01:37:49] [speaker-1] And in there, you might spread the user avatar.
[01:37:53] [speaker-1] And that means that whenever you the user avatar fragment. And whenever you modify the fragment. For example, you might
[01:37:59] [speaker-1] add the email or the image URL or the ID or whatever. Well, that gets sort of automatically
[01:38:05] [speaker-1] added to the parent fragment,
[01:38:08] [speaker-1] all of the parent fragments. And, ultimately, that bubbles up to a bunch of queries.
[01:38:12] [speaker-1] So you essentially are able to define,
[01:38:16] [speaker-1] and each of these fragments is associated
[01:38:18] [speaker-1] with one component in your code base ideally.
[01:38:20] [speaker-1] And that means that when you modify one component,
[01:38:23] [speaker-1] you can modify its fragment to have exactly the fields that you need locally
[01:38:29] [speaker-1] and no more and no less. And that automatically bubbles up to whatever queries, and these queries will fetch exactly the data that happens to be needed by the current configuration
[01:38:39] [speaker-1] of your
[01:38:40] [speaker-1] of your page.
[01:38:42] [speaker-1] So
[01:38:44] [speaker-1] you could reason locally, and everything ends up being correct. Now if you have
[01:38:49] [speaker-1] something else, let's say, TANSTAK and REST,
[01:38:52] [speaker-1] well, you kinda have some bad options.
[01:38:55] [speaker-1] So, for example, you're modifying some sort of deeply nested component.
[01:39:00] [speaker-1] If you add a field okay. It's not so bad. Now you go find whatever queries and add, like, the email field to those queries. Right?
[01:39:08] [speaker-1] And maybe that's, like, selecting it from rest. Maybe the back end now has to start returning email. I don't know exactly what it is, but you make some change, and you start getting email. But now if you stop using that email field, well, that's tough because now you have to go to these queries,
[01:39:20] [speaker-1] remove the email field. Maybe you have to kinda do some research to determine is any other subcomponent in the tree using that email field? And the answer is nobody does that amount of research.
[01:39:32] [speaker-1] And so
[01:39:33] [speaker-1] queries
[01:39:35] [speaker-1] get bloated. They get filled with fields that are not used.
[01:39:39] [speaker-1] Okay. Most people will look at that description and say, that sounds theoretical. That sounds like a big company problem. I only pass data down a couple of layers,
[01:39:47] [speaker-1] and that's also a problem. You have, like, limited the amount of complexity
[01:39:51] [speaker-1] that your app is able to absorb,
[01:39:54] [speaker-1] and you are prevented from breaking up your components into smaller and smaller parts even if that's the correct thing for your particular use case because you need to be able to reason about an entire tree in your head at once.
[01:40:06] [speaker-1] So once again,
[01:40:08] [speaker-1] all non Relay, non isograph frameworks
[01:40:11] [speaker-1] make the wrong trade off. They sort of limit your complexity
[01:40:15] [speaker-1] and make it so that if you try to do the right thing,
[01:40:18] [speaker-1] you are overwhelmed.
[01:40:20] [speaker-0] Real quick. What would you say to someone who would say,
[01:40:24] [speaker-0] that's all great, but I already know how to do rest, and the overhead I'm gonna get from GraphQL is not worth solving that that problem for me.
[01:40:32] [speaker-1] I I think it depends on
[01:40:35] [speaker-1] the situation.
[01:40:36] [speaker-1] You, for example, might come back from a week long vacation,
[01:40:41] [speaker-1] and you come back to your code base. And in the meantime, dev has made so many changes to it, and now you don't know what it's like. The reason that worked before was because you or some other code owner understood everything.
[01:40:52] [speaker-1] But now changes have been made and you don't yourself. Yeah. Yes. Yes. Exactly. And the same thing could be said about
[01:40:59] [speaker-1] Git.
[01:41:00] [speaker-1] Okay. I'm the only person
[01:41:03] [speaker-1] using modifying this repository. I don't need these fancy branches. Like, what's the point of that? You know? Like
[01:41:08] [speaker-1] but you still wanna use Git for
[01:41:11] [speaker-1] and the reason is that even though you are not multiple people,
[01:41:15] [speaker-1] you are multiple people one person in the morning, and then you've forgotten what you're doing on the evening and then whatever.
[01:41:21] [speaker-1] And furthermore, the developer experience cost of using Git is so low that it's worth it even on single person projects that have
[01:41:28] [speaker-1] a,
[01:41:30] [speaker-1] a linear history.
[01:41:32] [speaker-1] Same thing is true for GraphQL.
[01:41:35] [speaker-1] You want to be able to reason locally
[01:41:37] [speaker-1] when you modify components and not load
[01:41:40] [speaker-1] the,
[01:41:42] [speaker-1] the entire
[01:41:44] [speaker-1] code all the code into your head.
[01:41:46] [speaker-1] Okay.
[01:41:47] [speaker-1] Loading code into your head. That's using context. Okay. Context is expensive.
[01:41:51] [speaker-1] If you are an LLM trying to make changes, the less you have to reason about the entirety of the code base, the cheaper and more reliable and better. So there's there's a lot of reasons why you want to use GraphQL.
[01:42:03] [speaker-0] And LLM are where they work better when they have a schema to go along with. There's Yes. And there's some sort of thing that can guarantee,
[01:42:11] [speaker-0] you know, different types and how it can understand the whole architecture and how it all fits together.
[01:42:17] [speaker-0] So, like, if you could point an RFC or something or, like, a spec like GraphQL,
[01:42:22] [speaker-0] then there's a whole
[01:42:23] [speaker-0] set of things it already can figure out how to do within that world of that
[01:42:28] [speaker-1] convention. Mhmm. Yes.
[01:42:31] [speaker-1] Okay. So now we're gonna jump a couple steps forward.
[01:42:34] [speaker-1] Why isograph? Okay. So
[01:42:37] [speaker-1] with GraphQL,
[01:42:39] [speaker-1] you have fragments, and each fragment is associated with a specific function. So you have, like, this user detail avatar,
[01:42:46] [speaker-1] and it reads the fields that are needed by the user detail component. And that has to be a one to one connection because, otherwise, maybe you're overfetching or you're underfetching. So you don't wanna reuse fragments,
[01:42:58] [speaker-1] despite
[01:42:59] [speaker-1] what Apollo's docs will have led you to believe and so on. You don't wanna reuse queries. You want to just have exactly the one query per screen,
[01:43:08] [speaker-1] and it composes
[01:43:10] [speaker-1] correctly based on all of the things that are in the thing in the screen.
[01:43:14] [speaker-1] Okay.
[01:43:16] [speaker-1] So
[01:43:17] [speaker-1] if the user detail component,
[01:43:20] [speaker-1] I'm, by the way, just, like, on a random page here. I wasn't actually thinking about whether this is the correct, maybe quick start guide has a simple example.
[01:43:28] [speaker-0] Yeah. You should just pull up, like I mean, even better would be just, like, the graphql.com
[01:43:34] [speaker-0] fragment, like, a page and just the so people can get a sense for because if
[01:43:40] [speaker-0] if you don't know GraphQL, like, a fragment itself is a very specific kind of part of it because you have, you know, queries and mutations,
[01:43:47] [speaker-0] but fragments is kind of how you can compose
[01:43:50] [speaker-0] different
[01:43:51] [speaker-0] GraphQL queries together.
[01:43:53] [speaker-0] Right?
[01:43:54] [speaker-1] Yes.
[01:43:55] [speaker-1] Exactly.
[01:43:57] [speaker-1] So
[01:43:59] [speaker-1] there we go. We'll do this. Repository link.
[01:44:03] [speaker-1] Okay. So in particular, maybe you have
[01:44:06] [speaker-1] a,
[01:44:08] [speaker-1] this is actually in our, like, internal GitHub demo on IsoGraph.
[01:44:15] [speaker-1] If you have a component a res repository link component, this function right here, that happens to read some sort of essentially, you can think of this as a fragment for now. So there's some fields on repository, which is a type in your GraphQL schema.
[01:44:28] [speaker-1] You might read the name, ID, owner, login, whatever.
[01:44:32] [speaker-1] Well, there's a one to one correspondence between the the fragment
[01:44:36] [speaker-0] and the component that uses that data. Right. Yeah. Because you're pulling out these specific things with the GraphQL query. Each of them is going usually to some sort of, like, HTML fragment
[01:44:47] [speaker-0] to have it composed with a component. That's why it fits so well together with something like React.
[01:44:52] [speaker-1] Yes.
[01:44:53] [speaker-1] Yes.
[01:44:56] [speaker-1] Now with every framework except for isograph and, to some extent, Houdini, which is another great framework,
[01:45:04] [speaker-1] there that component
[01:45:06] [speaker-1] the fact that the
[01:45:09] [speaker-1] the fact that one
[01:45:11] [speaker-1] function reads a particular fragment is not known at compile time, and you can't
[01:45:16] [speaker-1] take advantage of that.
[01:45:18] [speaker-1] But on the other hand, with
[01:45:22] [speaker-1] IceGraph,
[01:45:23] [speaker-1] we know the fact that this repository link component reads this data. This is exactly one thing
[01:45:30] [speaker-1] for the,
[01:45:31] [speaker-1] for this
[01:45:32] [speaker-1] for our for our purposes.
[01:45:34] [speaker-1] So in particular, if you search for repository link, and I don't have the,
[01:45:40] [speaker-1] the
[01:45:42] [speaker-1] language server installed. I actually haven't, like, done anything with IceGraph on this new computer yet.
[01:45:47] [speaker-1] You'll notice here that we have this parent. I don't know what this parent is, it's some sort of GraphQL field. And we select the repository link on it directly.
[01:45:55] [speaker-1] Now the GraphQL schema does not have this repository link
[01:46:00] [speaker-1] as part as a field on it.
[01:46:03] [speaker-1] But because we defined this repository link here,
[01:46:07] [speaker-1] or here rather,
[01:46:09] [speaker-1] we can now just directly select it. So now, conceptually, what are you doing? You're starting with the home page. You're selecting
[01:46:16] [speaker-1] the body. The body might have a current blog post. The blog post has a blog header, and you're just selecting all these components through the field, and you just receive them. And they're already prebound to the data that they end up using. So here, this repository link, what do we do with it? Again, forgive the syntax errors because,
[01:46:34] [speaker-1] I haven't I guess I haven't run I need to run the I need to run the compiler in here because it generates a bunch of files.
[01:46:41] [speaker-1] And
[01:46:42] [speaker-1] in this repository link,
[01:46:46] [speaker-1] in here, parent dot repository link, that's a component,
[01:46:50] [speaker-1] that happens to know about all the fields that it selects. And so here, what if we change repository
[01:46:57] [speaker-1] repository link to
[01:47:00] [speaker-1] select some other fields? Well, nothing here changes. We're not passing any data down, but it happens to be it happens to know that it's closed that closes over those fields. Okay. We do pass set route. That's not part of the graph data. That's just a regular prop that we define here.
[01:47:17] [speaker-1] And so that's nice. That means that you can essentially define your entire
[01:47:22] [speaker-1] app as, like, a set of nested components.
[01:47:25] [speaker-1] And each of these components close over the data that they happen to use, and this, just like with GraphQL, generates a query for all the fields that are needed by a given page.
[01:47:34] [speaker-1] So let's just say let's just search for queried text.
[01:47:38] [speaker-1] Oh, so on our Pokemon demo, like, this generates this query.
[01:47:42] [speaker-1] And this is sort of what is executed.
[01:47:44] [speaker-0] Pokemon,
[01:47:45] [speaker-0] which includes the form, key, number, species,
[01:47:48] [speaker-0] and the sprite image.
[01:47:50] [speaker-1] Yeah.
[01:47:51] [speaker-1] And
[01:47:54] [speaker-1] yeah. So this is, like, the the query that is actually executed at compile time.
[01:47:58] [speaker-1] And oh, sorry. Not at compile time. Actually executed when you run the page. Yeah. And this will get all the data. Throws the string over to the GraphQL endpoint.
[01:48:07] [speaker-1] Exactly.
[01:48:08] [speaker-1] And then this at runtime
[01:48:10] [speaker-1] will
[01:48:11] [speaker-1] well, basically, we generate a bunch of files, which you don't need to look at, but they're just these JSON things. Let me find a slightly better one. Yeah. Cool. It's a bunch of JSON things. It's this AST.
[01:48:21] [speaker-1] And using this AST,
[01:48:24] [speaker-1] what we're gonna do is when we read this
[01:48:28] [speaker-1] pet updater,
[01:48:29] [speaker-1] I know it's small,
[01:48:31] [speaker-1] when you read this pet updater,
[01:48:34] [speaker-1] component,
[01:48:36] [speaker-1] it will use this ASD to read out the fields that it knows came back from the network response
[01:48:42] [speaker-1] and render the components
[01:48:44] [speaker-1] that we're talking about here.
[01:48:46] [speaker-1] So, okay, so that's a lot of, like, technical description.
[01:48:49] [speaker-1] It's not super
[01:48:53] [speaker-1] the the let me let me actually talk about why this matters. Well, one, there's
[01:48:57] [speaker-1] there's no way to mess this up. You can make whatever changes you want in a repository link, and nothing has to change anywhere else. You don't have to reason globally. So that means you or an intern
[01:49:08] [speaker-1] or,
[01:49:09] [speaker-1] Opus.
[01:49:10] [speaker-1] I mean, I don't know. Haiku can reason about these. And, like, you don't have to be that smart. You can just make the changes,
[01:49:20] [speaker-1] and everything just continues to work. There's just, like, so little boilerplate compared to any other framework.
[01:49:26] [speaker-1] Secondly,
[01:49:28] [speaker-1] there's some advantages to this to these two being,
[01:49:32] [speaker-1] associated at at build time. So, for example, if you defer the JavaScript
[01:49:38] [speaker-1] sorry. If you defer the data for some subpart of your tree like, let's say you have you fetch the blog post, and it takes a long time to fetch the comments section.
[01:49:47] [speaker-1] So you defer that. GraphQL has a facility for essentially fetching that as essentially a follow-up network response.
[01:49:56] [speaker-1] In GraphQL and Relay and every other framework, like, if you're going to defer some data like that, well, then you need to manually also probably
[01:50:06] [speaker-1] asynchronously
[01:50:07] [speaker-1] load the JavaScript for that component's
[01:50:09] [speaker-1] thing.
[01:50:10] [speaker-1] But because we know at build time that the component JavaScript and its data are both
[01:50:15] [speaker-1] well, there's one place where you can defer them both. And, thus, if you search for something like at loadable
[01:50:25] [speaker-1] lazy load artifact true.
[01:50:28] [speaker-1] If you do this well, what just happened? I wanna do this.
[01:50:33] [speaker-1] This this is, like, a bunch of tests.
[01:50:36] [speaker-1] But if you happen to do this, well, then
[01:50:42] [speaker-1] this is a broken test for because it's showing some sort of broken state on purpose.
[01:50:48] [speaker-1] This image display wrapper here, this image display,
[01:50:52] [speaker-1] the data for that image display component and the JavaScript will be asynchronously loaded when we render this component.
[01:50:59] [speaker-1] So that's, like, one of the benefits of of being able to connect these.
[01:51:03] [speaker-1] But there are more benefits. There are lots of benefits.
[01:51:07] [speaker-1] One of the other benefits is, like, imagine
[01:51:10] [speaker-1] your large company code base. How many user avatar components do you have? Probably, like, 50 gajillion.
[01:51:16] [speaker-1] And the reason for that is because it's, like, not really easily discoverable, and so you have so many duplicate things. But on the other hand, here, if you are on a user and you start typing
[01:51:25] [speaker-1] dot
[01:51:26] [speaker-1] avatar or something, it'll just suggest it'll suggest that for you if we have the l if we have the language server installed, which is not installed.
[01:51:35] [speaker-1] So, therefore, it will cut down on essentially
[01:51:39] [speaker-1] duplicate components. And instead, you will be softly
[01:51:42] [speaker-1] pushed into having the one right user avatar component that actually works for, you know, sort of all the use cases.
[01:51:51] [speaker-1] Yeah. That's the spiel. Thanks.
[01:51:54] [speaker-0] Yeah. So things like at at loadable, those are directives.
[01:51:57] [speaker-0] Right?
[01:51:59] [speaker-0] It looks like a directive, but it's really a nice graph thing. It's really nice graph thing. Okay. Yeah. Because that was the the thing that is mainly
[01:52:07] [speaker-0] makes it different from just pure GraphQL
[01:52:09] [speaker-0] because you you do you're not just throwing pure you're not just sticking to the spec. You're building things into it. So you're they're kind of GraphQL s queries,
[01:52:18] [speaker-0] but they're not exactly the same.
[01:52:20] [speaker-2] Yes. Or at least it's like a it's like a a superset, like,
[01:52:25] [speaker-2] graph all the GraphQL behavior with some added syntax,
[01:52:29] [speaker-2] kinda like TypeScript as with JavaScript?
[01:52:32] [speaker-1] Yes.
[01:52:33] [speaker-1] So for example, this blog item here, like, this image display wrapper,
[01:52:37] [speaker-1] is it it's a field that we're selecting on image.
[01:52:42] [speaker-1] But, like, type image here, it doesn't have that field.
[01:52:46] [speaker-1] So we're, like, we're augmenting the schema with a bunch of other stuff.
[01:52:50] [speaker-2] Right. Yeah. Yeah. And the things you add to the schema that it's not just data, it's UI, essentially, though. So when you fetch
[01:53:00] [speaker-2] when when you write or when you execute a GraphQL query and you select those fields, you don't just get JSON. You get a React component
[01:53:07] [speaker-2] that you can just return
[01:53:09] [speaker-2] from your from the React component that fetched that data,
[01:53:13] [speaker-2] and you'll just you'll have the UI for it
[01:53:15] [speaker-2] Yes. Which is pretty cool. Yeah.
[01:53:19] [speaker-1] So this might get a little bit in the weeds. Okay. But one of the things that you might notice about graph well, the one of the things about GraphQL is that in theory, you should not be removing,
[01:53:28] [speaker-1] fields from the schema. You should only be doing for you should not be doing backwards incompatible changes of which removing the field is one. Yeah. Now
[01:53:36] [speaker-1] you also have an issue where, let's say, you have a user,
[01:53:42] [speaker-1] and then you have this user's favorite restaurants.
[01:53:45] [speaker-1] Right? Okay. So the way you would
[01:53:48] [speaker-1] define that is a field called favorite restaurants on the user. Okay. Right?
[01:53:53] [speaker-1] Well, what if we have, like,
[01:53:55] [speaker-1] user's favorite restaurants in a given city? Okay. So now we have user, and then we have city,
[01:54:01] [speaker-1] and then we have favorite restaurants on that, like, weird combination of, like, stuff.
[01:54:06] [speaker-1] Right?
[01:54:09] [speaker-1] But, like okay. So maybe this is hometown. Right? User hometown favorite restaurants. Right? And, like, if you look at that, why are we doing this? Well, the answer is that if we were to fetch the user and fetch their hometown and then fetch the restaurants,
[01:54:23] [speaker-1] that would be a a network waterfall.
[01:54:27] [speaker-1] And GraphQL's
[01:54:28] [speaker-1] raison d'etre is to avoid network waterfalls. So you end up structuring this as part of the GraphQL schema. So you have the user and then their hometown and then favorite restaurants in hometown on user. Okay. Right? But, like,
[01:54:42] [speaker-1] that's also really awkward because, well, now it's not really favorite restaurants on a hometown on a town. It's just it's the users.
[01:54:51] [speaker-0] It's some tuple of the user plus the hometown and then favorite restaurants on it. Lot you take on a lot of complexity into the schema for the sake of the simplicity of the query.
[01:55:00] [speaker-1] Yes. And for the performance of it. Now Yeah. Uh-huh. Yeah. What exact why do we want that?
[01:55:06] [speaker-1] And the reason is that some particular version of some particular product wanted to show you the favorite restaurants in your hometown because it's hometown celebration month on yelp.com.
[01:55:18] [speaker-1] You know? And, okay, only web does that because web iterates faster than iOS and Android or something like that. Who cares?
[01:55:26] [speaker-1] But this extra
[01:55:29] [speaker-1] cruft gets added to your schema, and it's, one, visible to Android and iOS. Two, it's useless on their thing. And three,
[01:55:36] [speaker-1] it is specifically serving the specific needs of a specific UI.
[01:55:40] [speaker-1] Okay. How do we add fields in a particular
[01:55:45] [speaker-1] repository
[01:55:46] [speaker-1] such that it is only accessible in a particular piece of UI? Well, that's exactly what this is. This repository link does not get added to
[01:55:54] [speaker-1] the schema in the abstract.
[01:55:57] [speaker-1] It gets it's visible as part of this isograph project. And if this isograph project no longer wants to use the repository link, well, then it kinda disappears. Next version doesn't have it. Okay.
[01:56:08] [speaker-1] Now
[01:56:10] [speaker-1] this executes on the client. Okay. Repository link, it's a component. Maybe it's not the best example, but I think we have something like formatted date.
[01:56:18] [speaker-1] Okay. Just imagine we have a formatted date.
[01:56:21] [speaker-0] It somewhere exists. I just don't know what it's called. Takes the JavaScript date, turns it to, you know, y y y y dash,
[01:56:28] [speaker-0] and then Exactly. Yeah. Yeah. Year month date.
[01:56:32] [speaker-1] It's nice to define that
[01:56:34] [speaker-1] in as if it was a a client field just like these,
[01:56:38] [speaker-1] but it would also be nice to execute that on the server.
[01:56:42] [speaker-1] And so the next thing that Isograph will be doing I mean, in in theory, I mean, there's too many things
[01:56:48] [speaker-1] for me to do with my limited time. But one of the things I wanna do with Isograph is to allow you to move the execution of this thing onto the server.
[01:56:58] [speaker-1] So now you can do exactly what we just discussed, the favorite restaurants
[01:57:02] [speaker-1] in your hometown.
[01:57:03] [speaker-1] You can define that
[01:57:05] [speaker-1] in localized to a specific project. It can execute on the server for performance,
[01:57:11] [speaker-1] and your Android iOS teams are none the wiser.
[01:57:15] [speaker-1] And then when you modify things, well, whatever, it changes. The next version has a different version of hometown favorites.
[01:57:23] [speaker-1] You know?
[01:57:25] [speaker-1] Yeah. So that's the idea. And and the the the net effect
[01:57:29] [speaker-1] of all of this
[01:57:31] [speaker-1] is that your
[01:57:33] [speaker-1] app
[01:57:34] [speaker-1] is a tree
[01:57:36] [speaker-1] of
[01:57:37] [speaker-1] is like is like this DAG of stuff that needs to happen.
[01:57:41] [speaker-1] And isograph is, I think, a pretty good way of expressing this sort of DAG like, tree like workflow.
[01:57:49] [speaker-1] And
[01:57:51] [speaker-1] if you have this tree, you sort of can look at it in multiple different ways.
[01:57:56] [speaker-1] One way is, like, some work gets hoisted to the server. Okay. That's kinda like React server components. It's just basically what I described, except React server components is a bunch of limitations
[01:58:07] [speaker-1] that this gets to avoid. It has another benefit, which is that it's there's a big company behind it. So, you know, there's trade offs. But
[01:58:14] [speaker-1] in theory, this is a a better
[01:58:18] [speaker-0] a better model. You can also do things like give API keys or stuff. Like, you can do queries that can do other stuff if you're running on the server. Because this was the thing that when I worked at my GraphQL company, Stepsin, it was a hosted GraphQL endpoint,
[01:58:33] [speaker-0] but it'll be locked down from the top. So you'd have to run your GraphQL queries in, like, a serverless function.
[01:58:40] [speaker-0] And so that would kinda push you to doing it on the server, but then you would think a lot about your actual query and then get the data you need. And, like, you say, then you get exactly what you want for each page.
[01:58:52] [speaker-1] Yes. Yeah. That's exactly right. Like, you have, like you can there's a lot of stuff you can execute on the server. Maybe secrets.
[01:58:59] [speaker-1] Maybe you want stuff moved up there for performance.
[01:59:01] [speaker-1] Maybe you have and, also, maybe the back end thing is written in a different language.
[01:59:06] [speaker-1] In this case okay. So what are we doing here,
[01:59:09] [speaker-1] when we reference this image display? We're saying
[01:59:13] [speaker-1] from the perspective of this image display wrapper,
[01:59:17] [speaker-1] we'd well, okay. This is loadable. So, like, let's just talk about a simpler example. This
[01:59:21] [speaker-1] image display wrapper here, we don't know anything about it. All we know is that if there's some function that has some return value well, whatever. We have a return value. Happens to be a component, but, like, let's just say it's a string. Okay? We don't care how that string was calculated. We don't care where it was calculated. And so that and all we're doing is we're saying we want this particular string.
[01:59:42] [speaker-1] What if that function what if that image display wrapper was written in Python? Well, it has to execute on the server. The server is the only one that knows how to execute Python. But we could now
[01:59:52] [speaker-1] intersperse,
[01:59:55] [speaker-1] again, because of that isolation that we talked about earlier,
[02:00:00] [speaker-1] a lot of
[02:00:03] [speaker-1] a lot of work in sort of a tree like thing.
[02:00:07] [speaker-1] And yeah. Anyway, so I'm gonna
[02:00:10] [speaker-1] leave it there that there's a lot in common between both of the projects. Yeah. No. That's very Definitely.
[02:00:16] [speaker-0] And this is being used at Pinterest
[02:00:19] [speaker-0] right now, you were saying?
[02:00:21] [speaker-1] No. No.
[02:00:23] [speaker-1] There's a there's a startup that's using IsoGraph.
[02:00:27] [speaker-1] Barnum I'm using Barnum very extensively at Pinterest to ship a very large number of PRs.
[02:00:33] [speaker-1] And I've some other folks at at Pinterest and elsewhere have used Barnum,
[02:00:39] [speaker-1] but, like, I haven't really focused yet
[02:00:42] [speaker-1] on the
[02:00:44] [speaker-1] on the marketing. I haven't really strongly focused on marketing it yet.
[02:00:48] [speaker-1] So Alright. Well, who's using the isograph?
[02:00:52] [speaker-1] This company that is called
[02:00:54] [speaker-0] Also, one of you two right now, there's a, like, radio bleeding through or something. You gotta go ahead and guess that that's not me. Yeah. That's good. Yeah.
[02:01:05] [speaker-1] Bolt Foundry. There we go.
[02:01:07] [speaker-0] This company is I've heard of Bolt Foundry. What? You know them? That's so cool. They they didn't okay. Hold on. Bolt Foundry hosted GraphQL Texas, didn't they?
[02:01:19] [speaker-1] Not sure. I they're based in New York and Utah as far as I know. But let's see.
[02:01:27] [speaker-1] Maybe
[02:01:28] [speaker-0] for all I know. Yeah. They they hosted they hosted a GraphQL
[02:01:32] [speaker-0] meetup that I I did. It it may not have been too because I did a bunch, but that is why I've I've heard of Bold Foundry. So yeah.
[02:01:40] [speaker-1] Yeah.
[02:01:42] [speaker-1] Yeah. They're very happy users of IsoGraph.
[02:01:46] [speaker-1] They do. Yeah.
[02:01:49] [speaker-2] There are so many interesting things about GraphQL that I would oh, sorry. Not GraphQL. GraphQL as well, but IsoCraft specifically
[02:01:58] [speaker-2] that I feel like I want
[02:02:00] [speaker-2] I could talk about for forever.
[02:02:03] [speaker-0] I I think the way that If you want to come back for another episode, Robert, that we could do all on IceCraft, that would be great. We we still have more time, but just saying. But we'll throw that invitation out there. Oh, yeah. We'd we'd definitely be happy to. Yeah. Yeah.
[02:02:17] [speaker-0] Ahead, Dev.
[02:02:18] [speaker-2] Yeah. I mean, in in in specific, I think the way that
[02:02:23] [speaker-2] the way that you decide to compose queries and components together, that that
[02:02:28] [speaker-2] that feels very nice that they're kind of eliminates so much of boilerplate.
[02:02:33] [speaker-2] Like, it's not a framework that comes with a bunch of hooks that you need to learn how to use
[02:02:38] [speaker-2] or, like, custom components, anything like that.
[02:02:42] [speaker-1] Am I still okay. Yeah. Yeah. You're still right. I should hear you. Mike. Yeah.
[02:02:48] [speaker-2] Yeah. And so okay. One one thing that I was wondering is is there
[02:02:54] [speaker-2] you you mentioned that there's a build step
[02:02:57] [speaker-2] that kind of, like, goes through your routes and compiles together, like, one giant QWERTY that can fetch all the data for that page.
[02:03:07] [speaker-2] I'm guessing that compiler, like, literally goes through your React components to look at like, does it have to look through your React code to see what components you're rendering or just the SQUIDI?
[02:03:19] [speaker-1] No. It it's pretty dumb
[02:03:22] [speaker-1] in the sense that it looks for isograph literals.
[02:03:26] [speaker-1] Mhmm.
[02:03:30] [speaker-1] These isograph literals
[02:03:34] [speaker-1] are matched with a regex.
[02:03:36] [speaker-1] So it looks for literally exactly this, and then it attempts to process them. And it also makes sure that they are that they well, it checks, a very few small amount of other things.
[02:03:46] [speaker-1] And so it's basically looking for this pattern here,
[02:03:50] [speaker-1] but it doesn't know anything about JavaScript.
[02:03:53] [speaker-1] And then there are lint rules. So these Lint rules will enforce that this is
[02:03:59] [speaker-1] well,
[02:04:02] [speaker-1] are there Lint rules? No. There are no Lint rules. I no. They're not. There should be. Anyway, we also enforce that this is exported and so on and so forth. So there's, like, very there there are limited things that we do enforce to ensure that this is done correctly.
[02:04:14] [speaker-1] But
[02:04:16] [speaker-1] in terms of understanding JavaScript,
[02:04:18] [speaker-1] not at all.
[02:04:20] [speaker-2] Got it. Okay. Yeah.
[02:04:21] [speaker-1] You could, for example, fool this by doing something like Mhmm. Like
[02:04:25] [speaker-1] this.
[02:04:27] [speaker-1] I
[02:04:28] [speaker-1] mean, that actually is not a multiline.
[02:04:30] [speaker-1] Okay. Whatever. JavaScript doesn't have multiline,
[02:04:32] [speaker-1] things, but, like, you know, whatever.
[02:04:37] [speaker-2] Yeah. So it it sounds like something that could like, that might not need a build step, or am I off here?
[02:04:44] [speaker-1] Oh, no. It needs a build step.
[02:04:48] [speaker-1] It will I think I will not be able to find this because yeah, it's not in whatever zed marketplace there is,
[02:04:55] [speaker-1] does not include the extension.
[02:04:57] [speaker-1] T I l, we should publish it a bunch of other places. Not not surprising to me. Yeah. That's what the big limitations have said. Yeah. This is converted into
[02:05:07] [speaker-1] a bunch of files.
[02:05:08] [speaker-1] So in particular, that resolver reader that we talked about, so it's gonna have this author and title and content fields and so on.
[02:05:17] [speaker-1] And this blog item more detail is on there as well. It will also generate a
[02:05:24] [speaker-1] this param type here. So, basically, when you add and remove fields from this, this
[02:05:30] [speaker-1] gets modified.
[02:05:31] [speaker-1] And so now if you hover on this this blog item thing here, you know that you have these types here.
[02:05:38] [speaker-1] And
[02:05:39] [speaker-1] that can't be inferred from the JavaScript. I mean, from the that can't be inferred by TypeScript. Like, I'm not gonna try to go down that route. I don't think it's a good route. Right.
[02:05:49] [speaker-1] It's technically impressive to do that, but, like,
[02:05:52] [speaker-2] no. Like, right, like, building Doom in TypeScript
[02:05:56] [speaker-2] only at Exactly.
[02:05:58] [speaker-1] Yeah.
[02:05:59] [speaker-1] Yeah.
[02:06:00] [speaker-1] And what's also interesting about this is that, like I mean, this isn't
[02:06:04] [speaker-1] it isn't a anything that a back end knows how to execute, but we still have this query text here.
[02:06:11] [speaker-1] This other query text that yeah. Like this one. Right? Right. Okay. It's pretty boring ass query. But,
[02:06:18] [speaker-1] like, this thing is generated also. Right. And
[02:06:23] [speaker-1] one thing that's nice about this is that
[02:06:25] [speaker-1] so one of the benefits of GraphQL is you have fragment like composition,
[02:06:29] [speaker-1] but there's no fragments to be found anywhere in these query text. We have done the inlining ourselves.
[02:06:35] [speaker-1] And so that means that we are essentially doing fragment like composition
[02:06:39] [speaker-1] in user land.
[02:06:41] [speaker-1] So we can instead of generating GraphQL here, we could generate SQL. We could generate tRPC. We could generate your custom back end
[02:06:49] [speaker-1] code that says, like, hey. Data d b dot get node, dot get type name, dot get ID, whatever. Like and then return package that up and generate it for you. And isoGraph is written in a way that is
[02:07:01] [speaker-1] generic in the sense that there is an interface that we implement that knows how to generate GraphQL.
[02:07:08] [speaker-1] And there would be just as we just have to have another interface that implement that we implement that would generate SQL or would generate whatever custom back end stuff that you want.
[02:07:18] [speaker-1] And then,
[02:07:19] [speaker-1] again, we're not
[02:07:21] [speaker-1] sending this well, there are two ways to do this. One is you can send this string to the back end, which is sort of the easy no build process kinda way. But the other one is that you would send an you would register this at build time, get an ID back, and then Okay. You
[02:07:36] [speaker-1] would send that ID at runtime. And that ID will
[02:07:44] [speaker-1] will the the back end will look up that ID in a database or something, execute this, and send that value back to the It allows you to create, like, a level of indirection between the actual GraphQL query and how the front end accesses it. Exactly. And it's add security because, like, if you accept any arbitrary GraphQL,
[02:08:02] [speaker-1] well, then you could have something that sort of DDoS is your back end.
[02:08:06] [speaker-1] Right. Yeah. Or exposes information that you don't want to expose to users, but it's part of your GraphQL schema.
[02:08:13] [speaker-1] And, oops, nobody noticed.
[02:08:15] [speaker-1] So
[02:08:16] [speaker-2] Nice. Yeah. I'd be curious to see this
[02:08:19] [speaker-2] I'd be curious to see this work with some sort of a
[02:08:24] [speaker-2] a sync engine maybe where Mhmm. The same query can run both on the server and on the client.
[02:08:30] [speaker-2] And when you when you receive any data from server, you also
[02:08:34] [speaker-2] store it on the client side so you can do, like, instant
[02:08:39] [speaker-2] and the instant navigation. I guess Relay kind of does some of that. Like, there is a normalized cache.
[02:08:44] [speaker-2] Mhmm. What's what what is, like, the caching
[02:08:48] [speaker-2] and optimistic
[02:08:50] [speaker-2] story
[02:08:50] [speaker-2] if you have one in Isograph?
[02:08:53] [speaker-1] Yeah. So
[02:08:55] [speaker-1] while I figure out how to install PMPM and so on,
[02:09:01] [speaker-1] I
[02:09:02] [speaker-1] I thought I installed PNPM already. I guess I haven't. I mean, this is a really new laptop.
[02:09:06] [speaker-1] So
[02:09:07] [speaker-1] in isograph,
[02:09:08] [speaker-1] you have essentially
[02:09:12] [speaker-1] did it work?
[02:09:14] [speaker-1] Command not found PNPNY.
[02:09:16] [speaker-1] It's probably not in the it's probably there, but it's not in the Might
[02:09:20] [speaker-1] need to restart the terminal or some Yeah. Let me try. That's a good idea.
[02:09:25] [speaker-1] Nope. Still not there. It's not in the path. Yeah. Okay.
[02:09:30] [speaker-0] Weird. MPX PMPM.
[02:09:33] [speaker-1] That's what I needed to do.
[02:09:36] [speaker-1] Okay. So
[02:09:39] [speaker-1] has
[02:09:40] [speaker-1] a normalized store. So everything that we get from the back end gets keyed by that's keyed by ID, gets put into a normalized store. And then when we actually read the data,
[02:09:51] [speaker-1] we read the data from that store. So there's sort of two separate processes. The network responses right into the store completely coincidentally.
[02:09:59] [speaker-1] Reading reads from that same store. And there is a we we hope that the responses
[02:10:06] [speaker-1] give all the data that we need for the front end, and it happens to work out in that way.
[02:10:10] [speaker-1] But that's not, like, structurally guaranteed.
[02:10:13] [speaker-1] And
[02:10:14] [speaker-1] this means that,
[02:10:16] [speaker-1] we can do a lot of really cool things. So for example, in isograph, like in Relay,
[02:10:21] [speaker-1] if you try to read a component and some data is missing, it will suspend.
[02:10:26] [speaker-1] And so that means that if you navigate from a list view to a detail view, well, maybe you have enough information.
[02:10:32] [speaker-1] This is quite fine.
[02:10:35] [speaker-1] Goddamn it.
[02:10:39] [speaker-1] Maybe you have enough information.
[02:10:40] [speaker-1] You
[02:10:41] [speaker-1] know, it's not that isograph is hard to run. It's that I don't know how to install PMPM.
[02:10:48] [speaker-2] Hey. If if Claude can if Claude cannot also figure it out, then it's probably
[02:10:53] [speaker-2] you're fine. Yeah.
[02:10:57] [speaker-1] Yeah.
[02:10:59] [speaker-1] I I think I just need to add this to my z sharp c.
[02:11:03] [speaker-1] Mhmm. So okay. So if you navigate from a list view to a detail view,
[02:11:08] [speaker-1] the outer component, let's say the one that shows the title of the detail view,
[02:11:12] [speaker-1] will already have enough data inside of the store, and so it can immediately render. And if you wrap the rest of the content in a in a suspense boundary
[02:11:22] [speaker-1] I give up.
[02:11:25] [speaker-1] And
[02:11:27] [speaker-1] then you will immediately render the upper part, and then the the bottom part will suspend, and you'll show a spinner there. And then, eventually, it will pop in. So,
[02:11:36] [speaker-1] yeah, so there's actually a really good story here, but it actually goes beyond just the naive thing, which is what I described is also in Relay essentially and possibly in other frameworks as well.
[02:11:46] [speaker-1] But one of the things that you know about IceGraph is that you have this DAG of work that is being done.
[02:11:53] [speaker-1] And one of the things that we are sort of doing in but not fully,
[02:11:58] [speaker-1] and the the way it will work is that, ultimately, you will have everything
[02:12:03] [speaker-1] in,
[02:12:05] [speaker-1] all the precomputed stuff is stored in the Relay store. So, for example, the formatted date,
[02:12:13] [speaker-1] that is some sort of function that depends on the actual raw date. And then you have something like the, the current day display clock.
[02:12:20] [speaker-1] Right? That depends on the formatted date. Okay. So when the when the underlying date changes, well, then we recalculate the formatted date. Okay. But maybe the the the formatted date doesn't show the year and only the year changed or whatever. It doesn't show the seconds, and it only shows minutes. Right? So now we can short circuit. We don't have to rerender
[02:12:39] [speaker-1] the
[02:12:42] [speaker-1] the clock.
[02:12:43] [speaker-1] Right?
[02:12:44] [speaker-1] Okay. Maybe the the clock shows seconds, but whatever. The milliseconds changed, and the seconds didn't change. So we can short circuit and rerender the clock and not rerender the clock. And the whole thing will be like this
[02:12:55] [speaker-1] tree of work that we have calculated, and we will try to calculate the minimal amount of work that needs to be done in response to changes to the underlying data.
[02:13:07] [speaker-1] And
[02:13:10] [speaker-1] that is
[02:13:11] [speaker-1] kind of a universal problem.
[02:13:14] [speaker-1] A lot of what you wanna do is the minimum amount of work. The way you make apps be performant is you do less work. It's not that you get better at doing the existing work. It's that you figure out you're smarter about doing less work. So you have to keep track of what goes in what flows into what.
[02:13:28] [speaker-1] And that's how with isograph, like, when you make a change to something or other, you'll only see the components that actually need to rerender actually rerender.
[02:13:38] [speaker-2] It sounds to me, it sounds like the perfect framework to pair with Isograph is not React, but Solid.
[02:13:46] [speaker-0] I Of course, you would say that, dev.
[02:13:48] [speaker-0] Solid JS.
[02:13:50] [speaker-0] Team member,
[02:13:51] [speaker-0] undisclosed affiliations.
[02:13:54] [speaker-1] Yeah. I I I don't think you're wrong.
[02:13:57] [speaker-1] I think that the what's nice about Solid there's a lot of nice things about Solid.
[02:14:03] [speaker-1] And
[02:14:04] [speaker-1] one of them is the fact that it's, like, a little bit more stateful. Like, the the components actually have construction
[02:14:09] [speaker-1] are constructed once,
[02:14:11] [speaker-1] and that corresponds really well to what iso graph is doing. In React, like, you have this idea that the,
[02:14:21] [speaker-1] the component can render any number of times before it mounts. And that's kinda like a constructor, but it's also really a problem. But on the other hand, with Isograph,
[02:14:30] [speaker-1] we know
[02:14:31] [speaker-1] because we know that there's a query route, and this query route can reach the blog detail component.
[02:14:37] [speaker-1] That this blog detail component needs to be
[02:14:40] [speaker-1] constructed,
[02:14:41] [speaker-1] and it can be changed and modified and handled by the framework.
[02:14:45] [speaker-1] So that's the idea there is that we have
[02:14:49] [speaker-1] more hooks than than React
[02:14:51] [speaker-1] sort of allows you to do. It's sort of like the class version of React would have been a better fit for,
[02:14:56] [speaker-1] for IceGraph. I mean, it works just fine because the rendering part is relatively small.
[02:15:02] [speaker-1] But, like,
[02:15:06] [speaker-1] it did it. Okay. Let's see. Let's let's see. Wow. That's so fast. How did it did it, like oh, probably because I already had the, things in there.
[02:15:14] [speaker-1] Okay. So let me just take a look at the thingy. I think
[02:15:19] [speaker-2] Yeah. It might have run PNPM install earlier, which means you have everything cached.
[02:15:25] [speaker-1] Yeah. It probably did. It right? Because okay. So we wanna do PNPM
[02:15:29] [speaker-1] dev pet demo
[02:15:31] [speaker-1] named after our favorite host,
[02:15:33] [speaker-1] and
[02:15:35] [speaker-1] this will build a bunch of stuff in Rust.
[02:15:40] [speaker-1] Did you catch all that? So
[02:15:43] [speaker-1] anyway, so then little
[02:15:45] [speaker-1] Yeah. We're
[02:15:47] [speaker-1] mostly building the,
[02:15:49] [speaker-1] the Babel
[02:15:50] [speaker-1] not the Babel plug in, the SWC plug in. And what are we course. What are we complaining about here? Cannot find.
[02:15:58] [speaker-1] I need to add the target. Let
[02:16:05] [speaker-1] me just
[02:16:08] [speaker-1] that that didn't even copy it. Okay. So I just need to
[02:16:12] [speaker-1] add
[02:16:14] [speaker-1] WASM
[02:16:15] [speaker-1] 32
[02:16:16] [speaker-1] WOSEP one target.
[02:16:20] [speaker-1] See what the thing is we don't even need that because we only need that when we're changing it. We don't actually need it to run the thing. I could be a little bit better about not requiring that.
[02:16:34] [speaker-1] Yeah. So,
[02:16:35] [speaker-1] eventually, this will we'll get there.
[02:16:39] [speaker-1] So
[02:16:41] [speaker-1] that's the thing.
[02:16:43] [speaker-1] If you do work on a project, you don't know all the steps that are actually required to bootstrap it.
[02:16:49] [speaker-0] It's just running. It's been running running on your machine for so long.
[02:16:53] [speaker-1] Exactly.
[02:16:54] [speaker-1] And at some point in time, I installed that.
[02:16:56] [speaker-1] Okay. Cool. So it should be doing that, and it should work pretty well pretty quickly. Cool. Target installed. I believe it. Okay.
[02:17:05] [speaker-1] And,
[02:17:08] [speaker-1] yeah, and then we can actually, like, show off some of the
[02:17:15] [speaker-2] Yeah. But I I I I I understand the point that it's
[02:17:20] [speaker-2] Isograph
[02:17:21] [speaker-2] does a lot of work in
[02:17:24] [speaker-2] that that goes into making React app performant
[02:17:29] [speaker-2] to kinda, like, reduce
[02:17:31] [speaker-2] rerenders and to because,
[02:17:34] [speaker-2] basically, if if you have a component and you know exactly what that component depends on that what data that component depends on and you have that in a normalized store,
[02:17:43] [speaker-2] when that updates,
[02:17:44] [speaker-2] you can go and rerender exactly those components
[02:17:49] [speaker-2] instead of, like you don't have a
[02:17:51] [speaker-2] a top down tree
[02:17:53] [speaker-2] a a top down, like, tree rerender where one component rerenders and all the children rerender, and then the only way to put a break on that is, like, memoization.
[02:18:03] [speaker-2] Yes. This is, an almost, like, an additional layer of memoization.
[02:18:09] [speaker-1] Yeah. It's actually it's it's smarter about the memoization too
[02:18:14] [speaker-1] Yeah. Because
[02:18:16] [speaker-1] what? That didn't even that that was not even correct.
[02:18:20] [speaker-1] Because it has more information than than is known at runtime. Right? It it has the ability to look at a bunch of stuff and throw stuff away
[02:18:28] [speaker-1] Mhmm. And do the right thing despite not needing that. Like, one of the because it's very similar. I don't know if y'all have seen,
[02:18:36] [speaker-1] fate.
[02:18:37] [speaker-1] Fate is something that Christophe Chaudeau
[02:18:40] [speaker-1] not Chaudeau.
[02:18:41] [speaker-1] Christophe Nakazawa
[02:18:43] [speaker-1] Yes.
[02:18:44] [speaker-1] Has released.
[02:18:46] [speaker-1] And,
[02:18:47] [speaker-1] it is similar to Relay. It's similar to to IceCraft, but it does that sort of at runtime. So you actually have a data structure that does all this stuff.
[02:18:56] [speaker-1] And that allows you to do that allows you to do a few more things, for example,
[02:19:06] [speaker-1] dynamically construct queries for just the fields that are missing. But on the other hand, it prevents you from doing more stuff at build time, which is, I think, the trade off that Relay and IceGraph,
[02:19:17] [speaker-1] try to make.
[02:19:22] [speaker-1] Yeah. So let's see. I have no idea why these these build things are are failing.
[02:19:27] [speaker-1] Oh, yeah. It's because there's a newer version of,
[02:19:31] [speaker-1] I want a newer version of Rust. Yeah.
[02:19:34] [speaker-2] Yeah. Rust. Okay. Rust. Yeah.
[02:19:36] [speaker-1] So
[02:19:40] [speaker-1] as you can tell, new versions of Rust are are released, and I have to I have to do I have to make changes as a result.
[02:19:51] [speaker-1] Yeah. And so
[02:19:54] [speaker-1] what's nice about this is that, like,
[02:19:57] [speaker-1] you have some bad trade offs in React.
[02:20:00] [speaker-1] You, for example, need to specifically
[02:20:05] [speaker-1] break your components up into subparts
[02:20:08] [speaker-1] in order to,
[02:20:11] [speaker-1] theoretically
[02:20:12] [speaker-1] get some
[02:20:13] [speaker-1] of the performance benefit. Okay. Same thing is true in Mhmm. In isograph. Like, it may if you want to have that memoization layer between
[02:20:22] [speaker-1] the formatted date and the clock, well, then you need to have a separate formatted date thing, and the clock can't read the the date directly.
[02:20:30] [speaker-1] One of the things I want to do with isograph
[02:20:33] [speaker-1] is essentially have a way to
[02:20:36] [speaker-1] encode more functionality
[02:20:38] [speaker-1] into the query itself so that at build time, we know that
[02:20:43] [speaker-1] the formatting the formatting occurs, and it flows into the clock. And you don't need to do anything. You don't need to say, like,
[02:20:51] [speaker-1] I specific I mean, you can just kind of do it in the natural way.
[02:20:59] [speaker-1] Yeah. Are you kinda talking about, like
[02:21:03] [speaker-1] Yeah. But so you would dynamically apart.
[02:21:06] [speaker-2] Like, breaking apart components at build time? Yes. Exactly.
[02:21:10] [speaker-1] Because you're able to encode more of the logic inside of the isograph literal.
[02:21:15] [speaker-1] And you want it to focus on sort of not everything, so you probably want it to focus on, like, control flow and filtering and things like that because Mhmm. Otherwise, you go down the path of reinventing a version of JavaScript that has,
[02:21:30] [speaker-1] different semantics, but is, like, equally complicated, and gonna be very hard to integrate
[02:21:35] [speaker-1] with other stuff.
[02:21:37] [speaker-1] But, yeah, that's the I that's that's one of the ideas that I have about that as well.
[02:21:42] [speaker-1] But, yeah, but in general, you can do
[02:21:45] [speaker-1] you can be much more aggressive about caching with with Isograph because you know all the because the natural thing to do is to have these intermediate,
[02:21:56] [speaker-1] these intermediate things,
[02:21:59] [speaker-1] like like, formatted date and stuff like that, and then they become these sort of memoization boundaries.
[02:22:05] [speaker-1] Alright. It says it worked.
[02:22:07] [speaker-0] Let's see if it works. And I can go for another, like, ten or twenty minutes, but I'm actually have to start wrapping up soon. So my my workshop starts in a half hour. Oh, excellent. Okay. I won't keep you long. Let me show let's just do a one final demo. And and, Deb, you should also if you have any kind of final wrap up questions.
[02:22:25] [speaker-0] For me, I would just the only thing would be share, like, your socials and where people can get in touch and and learn more.
[02:22:36] [speaker-2] Can't find Isograph React.
[02:22:38] [speaker-1] Yeah. I probably just needed to run BNB install.
[02:22:42] [speaker-1] Why is it not finding it? It should be finding it.
[02:22:45] [speaker-1] I thought it would run this by oh, I I probably need to run build build. There's, like, an another
[02:22:53] [speaker-1] one of these other ones needs to be run. Actually, let's just,
[02:22:58] [speaker-1] I don't remember where exactly it is. Is it here?
[02:23:02] [speaker-1] No. It's here.
[02:23:08] [speaker-0] PNB. Like a mono repo structure you're in?
[02:23:11] [speaker-1] Yes.
[02:23:12] [speaker-1] I
[02:23:16] [speaker-1] need to build the JavaScript. Watch libs. That'll that'll do it. Yeah.
[02:23:23] [speaker-2] Okay. Right. So this is the mono repo with isograph itself and some demo
[02:23:29] [speaker-2] Yes. Applications.
[02:23:30] [speaker-2] Right?
[02:23:31] [speaker-1] Yeah.
[02:23:34] [speaker-2] Yeah. Now I should be able to find. Because I'm guessing isograph react points Hey. Yeah. Version of the local package.
[02:23:41] [speaker-2] Nice. Got your query. Got your cards.
[02:23:45] [speaker-0] Yes. Bunch of pets.
[02:23:47] [speaker-0] Classic GraphQL demo.
[02:23:49] [speaker-1] Exactly.
[02:23:50] [speaker-1] Okay. So let's go ahead and add some delay here.
[02:23:54] [speaker-0] Let's just say This this shit makes me so nostalgic. You guys have no idea. I haven't done GraphQL in, like, three years.
[02:24:02] [speaker-1] Nice. Nice. Okay. So let's go ahead and give it a a thousand milliseconds of delay. Okay.
[02:24:08] [speaker-1] And then close this out. And
[02:24:12] [speaker-1] two oh, I called it two seconds of delay. So now we have loaded
[02:24:17] [speaker-1] the,
[02:24:18] [speaker-1] like, Mikaela's name and image.
[02:24:21] [speaker-1] And so when we navigate here, you're gonna have a two second delay. Well, one, it has to get the JavaScript, and then it's gonna show the top. And then, oh, that's interesting. Oh, let's try that again. Not sure why that happened. Yeah. What you want? Loader? Yeah.
[02:24:35] [speaker-1] So you noticed that it showed the top first immediately and then the bottom. Even though the server is running locally, this takes exactly zero seconds in practice.
[02:24:42] [speaker-1] But now if we press back, well, it goes instantly.
[02:24:45] [speaker-1] The images
[02:24:47] [speaker-1] redownload because, I guess, it's Next. Js, and those images are not really they're they're not a scratch problem.
[02:24:54] [speaker-1] And if you go back to,
[02:24:55] [speaker-1] this demo again, now it's gonna everything's gonna load immediately
[02:24:58] [speaker-1] even though
[02:25:00] [speaker-1] even if we were to make another network request in the background.
[02:25:04] [speaker-1] So now if we go here It's state file to validate?
[02:25:08] [speaker-1] Yes. Well,
[02:25:11] [speaker-1] you can you can opt into that. Yes. You could do that if you want. Okay.
[02:25:15] [speaker-1] But it's sort of up to you, whatever you want. So here, if we go to oh, I don't even have the
[02:25:20] [speaker-1] wow. I don't even have the React dev tools.
[02:25:23] [speaker-1] That's how new this computer is.
[02:25:27] [speaker-1] Oh, item is inactive. Enable now. Re enable. Okay.
[02:25:33] [speaker-1] So here, if we have the
[02:25:36] [speaker-1] do we have the React dev tool? How do I enable them? Where do they go?
[02:25:41] [speaker-1] No. I don't know how to do the React dev tools.
[02:25:45] [speaker-0] I haven't done React dev tools in a while. Yeah. They're enabled. Like dev. I went over to the dark side.
[02:25:52] [speaker-0] Solid. Yeah.
[02:25:56] [speaker-2] Okay. Well, in theory an application, I think. I think that it it's now moved into some other tab. I don't know which one.
[02:26:03] [speaker-1] Okay.
[02:26:04] [speaker-1] Application?
[02:26:06] [speaker-2] That was Or not. No. Okay. I'm No. I thought it was remembering something else.
[02:26:11] [speaker-1] Yeah.
[02:26:13] [speaker-1] Anyway,
[02:26:14] [speaker-1] whatever. If we were to show that, then if you were, for example, to change the best friend here, none of this stuff would rerender. None of this all this other stuff down here, it would just show the new one here. And here, if you touch this, it will just rerender this exact specific component despite all of these components reading from the same,
[02:26:34] [speaker-1] from the same object, essentially.
[02:26:37] [speaker-1] And,
[02:26:39] [speaker-1] theoretically
[02:26:40] [speaker-1] I mean, if you were to do this as a React component, you would thread data down from the root and pass it to every child. And so that pet
[02:26:48] [speaker-1] has changed because now its check ins have changed and its,
[02:26:52] [speaker-1] you know, its best friend has changed.
[02:26:54] [speaker-1] So you would pass that data down,
[02:26:57] [speaker-1] and everything should recalculate and rerender. And that's incredibly
[02:27:02] [speaker-1] costly,
[02:27:03] [speaker-1] especially if you have if you're paginating and you have, like, hundreds of items. Like, the first couple pages might be performant, and it gets slower and slower and slower. And with something like Isograph,
[02:27:14] [speaker-1] you just rerender the components that actually have changed,
[02:27:17] [speaker-1] so it ends up staying snappy.
[02:27:21] [speaker-0] Nice.
[02:27:22] [speaker-1] Yeah.
[02:27:24] [speaker-0] I think that that's that's a good place to end it. Yeah. No. Very cool, man. Thank you for coming on and sharing both these projects. Very, very interesting. And it's great that they're open source and that, you know, anyone can can try these out. So so we're always all about here.
[02:27:41] [speaker-2] Yeah. Why don't you just share Except that they're both in Rust, which means you need a PhD before contribute.
[02:27:49] [speaker-0] Not with the ages, but alright. Whatever. That's what I ask you to. Yeah.
[02:27:57] [speaker-1] So worth learning, Rust. I think it's a great language. Mhmm. I would encourage y'all to learn it. So Alright. So you're at x.com/statistics
[02:28:07] [speaker-0] for the win.
[02:28:09] [speaker-1] Yes. Exactly. Let me show that.
[02:28:14] [speaker-1] Can I jump to my profile? Yeah. Here we go. Yeah. And then think I've got FVW. Links to
[02:28:20] [speaker-0] isograph
[02:28:21] [speaker-0] and all that stuff I'll have in the
[02:28:24] [speaker-0] description of the YouTube video.
[02:28:27] [speaker-2] And what would you say is the easiest way for someone to use Barnum? Let's say I let's say I use Codex right now, and
[02:28:35] [speaker-2] I'm kinda tired of
[02:28:38] [speaker-2] long sessions or short sessions, and I wanna adopt
[02:28:42] [speaker-2] Barnum to re and to do refactor work, to do automations,
[02:28:46] [speaker-2] background, whatever,
[02:28:47] [speaker-2] what would be the do I just go to Codex and say that start using Barnum on this project?
[02:28:53] [speaker-2] Yeah. Is there, like, a skill dot m d file that teaches agents how to write Barnum?
[02:28:58] [speaker-1] If you point Barnum,
[02:29:00] [speaker-1] if you point them to this, best practices doc,
[02:29:05] [speaker-1] it does a pretty good job. I mean, this is this is basically every single issue that I've ever encountered when asking it to do stuff. So I just have it look to
[02:29:16] [speaker-1] look at the best practices and read the docs, and it tends to be after that pretty good.
[02:29:23] [speaker-1] The this it tends to be pretty good at that point in time at writing Barnum workflows. Can you add dot m d to your URL and just get a markdown page?
[02:29:31] [speaker-1] I should. I should do that.
[02:29:34] [speaker-1] But the answer is no. Okay.
[02:29:37] [speaker-0] Which is, yeah. You know? Low hanging fruit. This Docusaurus?
[02:29:41] [speaker-1] Yeah. It's Docusaurus. Oh, so maybe we do have it. I know a Docusaurus.
[02:29:45] [speaker-0] Doxite when I see one. Yeah.
[02:29:50] [speaker-1] That's great. So I might go off talking first. It does exactly what I need. You know? I know Sebastian, and he's he's super cool. So He is really awesome. Yeah.
[02:29:59] [speaker-0] Great.