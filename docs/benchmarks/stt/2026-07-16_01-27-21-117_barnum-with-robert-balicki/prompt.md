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
[00:00:03] [1] And we're live. Welcome back, everyone, to "AJC and the Web Devs." We have a very special episode today: we have a new guest, never been here before, Robert.
[00:00:14] [1] Really happy to have you. You're a GraphQL OG, you're working on some cool AI stuff, so why don't you go ahead and introduce yourself and let our listeners know who you are and what you do.
[00:00:26] [2] Awesome. Hey folks, uh, my name is Robert. Super pumped to be up here.
[00:00:31] [2] I guess "Dev" and I go at this point in time way back, but like, it's the first time—no, it's the second time that I'm doing a stream with you.
[00:00:39] [2] So I'm like, really, really excited about this, to keep this tradition going.
[00:00:42] [1] I was curious about that, actually.
[00:00:44] [3] React Miami.
[00:00:45] [2] Yeah! There we go. Yeah.
[00:00:47] [1] Oh, what year?
[00:00:50] [2] 24, I believe.
[00:00:52] [1] 24, okay. I was there in 2023. I loved it. It was really fun.
[00:00:57] [2] That is—it's my favorite conference. I want to go one day as—well, the first time I went was not as a speaker, as an attendee, and that's the way to go.
[00:01:06] [2] Because last—or this year—I went as a speaker, and I was just holed up in my room practicing right until the very end, so I got to miss all the really cool events.
[00:01:16] [2] Oh well. Oh well. It's all good. Yeah, so my name is Robert. Quick intro: I currently work at Pinterest, where I'm on the web platform team.
[00:01:25] [2] Before this, I was at Meta on the relay team. At Pinterest, the primary thing that I've been working on is helping the company adopt GraphQL on web.
[00:01:35] [2] And the, sort of, the big reason why that's not super easy is because if you start converting a screen to use GraphQL, you're not only fetching data in a different shape, you're also fetching it from a different endpoint
[00:01:46] [2] . So you kind of have a couple of bad options. One is rewrite the whole screen, good luck.
[00:01:51] [2] And the other is make more network requests, which hurts performance. So sort of the—my sort of marquee thing there at Pinterest has been working on the Relay Migration API.
[00:02:03] [2] Relay is a framework for building GraphQL—or data-driven apps powered by GraphQL—which I worked on at Meta.
[00:02:10] [2] And the Relay Migration API essentially allows you to allow—to make components agnostic about where they get their data from.
[00:02:18] [2] So you can start at the leaf and make the component not care whether it gets REST or GraphQL data, and then sort of build your way up.
[00:02:24] [2] Once you get to the root, run some experiment, and actually flip on GraphQL for an entire screen at once.
[00:02:29] [2] And that's pretty cool, because a lot of times you turn that on and you discover, hey, there's some missing logging on the backend, or performance isn't quite where you got—where you wanted it.
[00:02:39] [2] So this is kind of nice. Yeah. Anyway, really excited to be on here.
[00:02:44] [1] No, that's super cool. We're going to get deeper into GraphQL probably in the second half of the episode.
[00:02:50] [1] As I said before the show, I'd be curious to hear your kind of coding backstory.
[00:02:54] [1] I always like to know how people, you know, first learned to code. We've never met before.
[00:02:59] [1] I was a boot camp kind of student. I originally had a music major and then got into all this stuff through, you know, later in life, like my late 20s.
[00:03:09] [1] And Redwood was kind of how I became into open source, and that was, you know, a GraphQL framework.
[00:03:16] [1] Didn't use Relay, used Apollo Client. So I've said that, actually, the one GraphQL project that I never really went super deep into was Relay.
[00:03:25] [1] I went deep into almost all of them, which is kind of ironic, because I would argue Relay is probably the most important GraphQL project ever, in certain ways.
[00:03:33] [1] So I would definitely be curious to hear more about that from you. But yeah, so what was your first line of code, your first language?
[00:03:41] [1] How did you first start programming?
[00:03:43] [2] I think I did a little bit of Logo. I don't know if y'all remember that one.
[00:03:49] [3] Oh, yeah.
[00:03:51] [2] The little triangle that moves around. But I think the biggest—I didn't really do all that much coding until I was, let's say, 22 or so, and I had my first job out of college.
[00:04:03] [2] And
[00:04:05] [2] it was building reports in Excel and doing them in PowerPoint and stuff like that, doing like market research.
[00:04:12] [2] And I just ended up, like, automating a lot of my job. And that was—that was awesome.
[00:04:17] [2] Like, it took something that used to take several weeks per month and, like, turned into like a 15-minute process, basicall
[00:04:25] [2] y.
[00:04:25] [1] Yeah, I—
[00:04:26] [2] Oh, that made me—no, no, I majored in math and stats. So I did a little bit, like, statistics programming and stuff like that, but like, no coding standards.
[00:04:37] [1] Right, yeah.
[00:04:38] [3] That explains the username.
[00:04:39] [2] Yeah. Yes, I think that's—I got my Statistics FTW
[00:04:44] [2] Twitter account around that time, so.
[00:04:47] [1] Yeah, like the—what do you think of that quote? There's lies, damn lies in statistics.
[00:04:53] [2] I think it's awesome. I think honestly, like, statistics is—I'm very happy that I studied statistics.
[00:04:59] [2] Even more so, I think, than studying math. Both are very interesting. I ended up—I started out majoring in political science, and during my freshman year I wrote one essay on the history of the Peloponnesian War on the Mel
[00:05:12] [2] ian Dialogue. And like, I used it three times in different classes, and I was like, "Oh, this is not fun."
[00:05:18] [2] Like, if you have the opportunity to get away with it, you do. And on the other hand, I took like this stats and polycy course, and it allowed me to, like, make these precise statements.
[00:05:29] [2] Like my first introduction to like p-values and stuff like that. And I was like, "This is so much cooler," rather than sort of the airy, foofy world of writing that I had come from.
[00:05:41] [1] Yeah, no, that's super cool. That's a really interesting background. So just a little more on that: how did you get involved in Meta?
[00:05:51] [1] Because I'm assuming you weren't hired to, like, do GraphQL, or maybe you were.
[00:05:55] [1] How did that work?
[00:05:58] [2] I worked for a bunch of startups when I got into tech, and then I ended up changing and getting a job at Meta.
[00:06:06] [2] I actually run Rust NYC, and I had presented about a framework that I built for building
[00:06:13] [2] web apps that—where you write Rust and it compile—I mean, superficially looks like React, and it compiles into WebAssembly.
[00:06:20] [2] And somebody from Meta was in the audience. I think they kind of pushed for
[00:06:26] [2] me in the back. I don't know.
[00:06:29] [1] Is that Rust.NYC?
[00:06:31] [2] Yeah, Rust.NYC is the—
[00:06:35] [2] I think that's our domain. Yes, that's it. You can find it. You can find—you can get access to the Discord there.
[00:06:42] [2] We actually are associated with a bunch of other meetups at this point in time, like Rust Boston.
[00:06:47] [2] There's starting a couple in Florida. We have some going in LA and San Jose, so like the empire grows.
[00:06:55] [1] That's cool. Let me know if you ever want to get a St. Louis one going.
[00:06:58] [2] Oh, yeah, I absolutely would love that. And we can provide whatever support you need as well.
[00:07:02] [2] I'm thinking, like, what would be really cool is to have a circuit where we basically share speakers, and if they happen to be in whatever destination, then we can arrange for them to have a, you know, a meetup on relativ
[00:07:15] [2] ely short notice.
[00:07:16] [1] I love that you are involved in the meetup stuff, because I used to do a lot of the Jamstack meetups.
[00:07:23] [1] Mostly virtual, because I got into coding in 2020, so it was like the time to do online meetups.
[00:07:31] [1] So I remember when I was, like, I think it was, you know, September, October, November, I had like a—I would do—I remember one day I did two meetups in one day.
[00:07:40] [1] Like, I was like, hit Seattle, and then I hit, you know, like Oregon or whatever.
[00:07:44] [1] So yeah, it was an interesting time to be doing meetups.
[00:07:49] [2] Yeah. A lot of them, like, they didn't survive COVID. It's kind of sad.
[00:07:55] [2] Yeah. I'm glad that we kept Rust NYC going. Less frequently during COVID proper, but like, we kept it going.
[00:08:02] [2] So to answer your earlier question, I joined Meta, and then you do this team matching thing, or at least at the time you do this team matching thing.
[00:08:09] [2] And I ended up just.
[00:08:10] [1] I've heard about that. They kind of give you—you try out a bunch of different groups to see where you would be best placed.
[00:08:16] [2] Yes.
[00:08:18] [2] And I had one criteria, which was to join a team that used Rust. And so I would just sit there looking at the internal, sort of, GitHub tool, Fabricator, and looking at PRs that touch Rust files, and then
[00:08:35] [2] looking up the person in the Space View tool and being sad, because everybody was in the Bay Area or Seattle or whatever.
[00:08:42] [2] And then one day I found somebody who was based in New York. I was like, "Oh, this is awesome.
[00:08:45] [2] " I sat down next to him. Like, "I'm joining your team." And then he was like, "You should probably talk to my boss.
[00:08:49] [2] " And so
[00:08:51] [2] by doing that, I got on the team. And it was awesome. It was really, really high coding standards, and it was very difficult for a long time.
[00:08:58] [2] And I was in the middle of onboarding when COVID happened, and I was like, "Whatever, I'll finish it in a couple weeks.
[00:09:04] [2] " And then I sort of forgot about it. So I realized, like, a year later that I'd gone through some amount of unnecessary pain and struggle as a result of having never completed the onboarding and never really just gotten
[00:09:16] [2] from other folks on the team, like, "Hey, this is how it works." And Relay is a fairly complicated framework, so it took a lot of just spelunking and learning, and I don't think I was—I think now I would be much better at
[00:09:29] [2] doing something like that, having done it once. But at the time it was—it was a lot.
[00:09:34] [1] Of course, yeah. First time you do anything in your tech career, it's always so daunting.
[00:09:40] [1] Like, I remember when I first got my job, you know, it was like it was terrifying.
[00:09:44] [1] I was so worried about every little thing I was doing, you know? And now that we got like agents, it's—you have so many better resources available to you.
[00:09:54] [2] Very true.
[00:09:55] [3] And even inside a tech company, if you're just, like, working on, like, some sort of a feature or app team, that's different.
[00:10:01] [3] But you're working on Relay, which is like a platform that's probably used by a bunch of different teams within the company, which is like a different kind of experience.
[00:10:11] [3] And I think the way
[00:10:15] [3] I first discovered you and your work through a talk at ReactCon, like reintroducing Relay, which I think was an amazing talk.
[00:10:24] [3] And that kind of—I think the way that you kind of talked about those concepts, the way you introduced the framework, I think, like, that caught my attention more than the framework itself.
[00:10:37] [3] And I think over time, the, like, more talks that you have given, I think that's one of the things that I appreciate a lot about
[00:10:45] [3] your talks and content, which is, like, just the way that you
[00:10:51] [3] structure things, the way you explain things. And I think you put a lot of effort into them as well.
[00:10:56] [3] So I'm curious when, like, how that happened, like, how you kind of got into,
[00:11:03] [3] I guess, like, giving a talk about Relay instead of just, like,
[00:11:10] [3] work, like, writing some code for it. And maybe, like, did you kind of discover that, "Oh, this is something that I want to do more"?
[00:11:18] [2] Thanks. I actually really appreciate that. I do try to put an effort into my talks.
[00:11:23] [2] I think that some people are kind of amazing at giving talks. There's that one guy that comes to mind that does, like, the—I don't know if you're—the most famous YouTube guy that does, like, a bunch of really cool thing
[00:11:38] [2] s. That really doesn't mean I'm.
[00:11:40] [1] Private jam?
[00:11:41] [2] No, no, no, I'm not talking about somebody like that. Somebody who does conference talks from back in the day.
[00:11:45] [1] I mean, for me it was Rich Hickey.
[00:11:48] [3] Is that Dylan Betty?
[00:11:49] [1] Close to God.
[00:11:49] [3] With the art of code?
[00:11:51] [2] No, no, there's a—there was one conference talk about, like, what was, like, what was stuff like—it was from the perspective of the '50s looking forward.
[00:12:01] [1] Oh, Joe Armstrong.
[00:12:03] [2] I don't think I'm thinking of him. I'm thinking of somebody else. But I do like Joe Armstrong, actually.
[00:12:09] [2] Okay, whatever, whatever. There are just some people that have.
[00:12:13] [1] I'm very curious if it comes to you. I want to know.
[00:12:15] [2] God, what a sidetrack.
[00:12:17] [1] No, this is great. This is the kind of diversions I like. Because I love conference talks, and I haven't seen your Relay talk, but I'll check it out after the show, because I've seen a lot—I've watched a ton of talks from
[00:12:30] [1] those conferences specifically, those Re
[00:12:35] [1] actConf ones. Like, when I first was getting into all this stuff, I was trying to get a sense of, like, what all these tools were.
[00:12:41] [1] So I was going back and I was watching, like, all these talks, like, you know, Pete Hunt and, like, stuff like that, you know?
[00:12:46] [1] And that gave me a ton of context for what was going on in things like React and GraphQL and Relay, and, like, what are all these things, how do they fit together?
[00:12:55] [1] Because, you know, what I've said about the interesting thing about GraphQL is Facebook had this whole stack where they had React and GraphQL and Relay and Flux, like, even before Redux.
[00:13:06] [1] And then all those things were kind of broken apart and introduced to the open source world in a way where it wasn't clear that they were all supposed to be put together.
[00:13:14] [1] And I feel like that made it really confusing for people if they didn't understand that all these tools were meant to be a certain part of a larger architecture.
[00:13:23] [2] Yeah.
[00:13:27] [2] Yeah, so I guess to Dev's question, like, I had been—I've been doing presentations for a long time.
[00:13:33] [2] I remember in fourth grade, like, being a bit of a class clown, like, liking to do that.
[00:13:39] [2] I did one where I pretended to be
[00:13:43] [2] that Simpsons character. "Hi, I'm Troy McClure," that one, doing something like that.
[00:13:47] [2] And I remember my parents being like, "Nobody's going to get this reference." And I'm like, "You're not the right age for this.
[00:13:53] [2] " Like, "Yes, they will."
[00:13:56] [2] And yeah, and then I did Speech and Debate in high school, and I did.
[00:14:01] [1] Oh, you're a Speech and Debate kid. That's funny. I have good friends who did Speech National Championship.
[00:14:08] [2] Ooh, fancy.
[00:14:09] [1] His name is Blake. He went to the two big speech schools, Kentucky and the other one.
[00:14:14] [2] Okay.
[00:14:17] [2] But yeah, I think, like, conference talks and talks in general—it doesn't even really have to be conference talks, talks at meetups—like, there are these super high-value artifacts, right?
[00:14:30] [2] I think a lot of people should be just putting more effort into them. And I also happen to enjoy it, so maybe it's easy for me to say, and obviously, like,
[00:14:45] [2] therefore I lean into it. But I do like to give good conference talks. I think it's really—it does
[00:14:53] [2] allow you to reach a different audience and more people. So, for example, at Pinterest, when I interviewed there, sort of everybody that I interviewed with—not everybody, maybe, but at least some of the people knew about
[00:15:06] [2] some of my side projects and some of the conference talks I had given. And it coincided with I had just gotten into
[00:15:14] [2] GraphQLConf, so I was about to—so that was nice. Like, I got to just say, like, "Hey, I'm about to speak here," which I think makes you look a lot better.
[00:15:24] [2] Likewise, like, when I said at Meta, like, somebody in the audience had seen me.
[00:15:29] [2] So I think that's cool. I think, honestly, like, it's worth it for folks to do it.
[00:15:33] [2] Folks should do more stuff like that. And then, in terms of effort, like, I put a lot of effort.
[00:15:42] [2] This summer I put in—I did three conference talks, and it was two, too many. So I would not recommend doing that.
[00:15:48] [2] I was very overwhelmed for a month and a half because of that. And that's why ReactMiami was so last minute, you know?
[00:15:56] [2] I was, like, in my hotel room until literally the moment of.
[00:16:01] [2] But I would still recommend it, because, yeah, you know, it's fun, it's good, it's a great way to meet people.
[00:16:08] [2] It's a lot easier to meet folks at conferences if you are a speaker, because folks will come up to you, or you have something concrete to talk about, talk with somebody about.
[00:16:17] [2] You don't have to be like, "So what kind of stuff are you into?" You know? And, like, try to find the overlap.
[00:16:22] [2] Instead, you can just say, like, "Hey, I like your talk about, I don't know, Redux or, you know, TanStack or whatever.
[00:16:29] [2] " And then, of course, if you're giving a talk, you want to give a talk about it, you know, with other folks.
[00:16:34] [2] I mean, at least most of the time. So anyway, that's my little spiel.
[00:16:39] [3] Nice. Yeah, I always feel like being a regular attendee at a conference is, like, the worst thing to do, because, like, it's like the worst place to be, even as a volunteer.
[00:16:49] [3] Like, volunteers usually get free tickets to a conference, like, they don't have to pay, but they still have, like, a, I guess, like, access to more, I guess, backstage things and a better reason to maybe talk to people
[00:17:03] [3] . Obviously, as a speaker, you have a lot more,
[00:17:08] [3] like, a much easier way kind of breaking the ice. But yeah, I think maybe we can talk about conferences forever.
[00:17:14] [3] We can also talk about
[00:17:17] [3] GraphQL for a long time. I think we'll circle back to GraphQL, Relay, and Isograph in the second half.
[00:17:24] [3] But yeah, I'm really interested in hearing what was your, like, early work with AI.
[00:17:33] [3] What are the things that you kind of
[00:17:36] [3] , that you were excited about, that you struggled with, and how did you end up at Barndum?
[00:17:43] [2] Yeah. So
[00:17:46] [2] I
[00:17:48] [2] definitely knew about.
[00:17:49] [1] Recently, the echo. It just.
[00:17:52] [2] Is that coming from.
[00:17:53] [3] Is it from my side?
[00:17:54] [1] In my event. Yeah, it's gone now.
[00:17:58] [2] Okay.
[00:17:58] [1] Go ahead, Robert.
[00:17:59] [3] I'll put on my earphones.
[00:18:01] [2] Yeah.
[00:18:03] [2] Yeah, so I knew about Bitcoin in 2008, and then I looked at it and I was like, "Man, the Oracle problem.
[00:18:11] [2] It's insurmountable. Like, who's going to, you know?" Anyway, so I live with that regret.
[00:18:15] [2] And then AI. I was very abundantly clear among my friends and I that, like, AI is going to change the world, like, I don't know, a couple years ago.
[00:18:25] [2] I don't really know what the timeline is.
[00:18:28] [2] But then I still, like, was more focused on Isograph and just getting very good at
[00:18:35] [2] , you know, efficiently making code changes manually. And then it really took until this year, which was months after sort of the winter of everyone using 4.
[00:18:47] [2] 5 for all their side projects, which is an eternity. I slipped and I broke my wrist, and so I couldn't type, because I use an external keyboard and, like, it's very thumb-heavy, and I just kind of couldn't do it.
[00:19:03] [2] And I ended up deciding at that point in time, one, to, my wife turned me on to WhisperFlow, and two, I decided to try to use Claude Code for everything.
[00:19:15] [2] So I sort of vibe-coded my way into a way to use my computer entirely with one hand.
[00:19:20] [2] So just kind of like a layer system plus typing plus, like, a custom keyboard layout.
[00:19:26] [2] And
[00:19:27] [2] also,
[00:19:30] [2] it was really clear from doing that, like, the how much you benefit from infrastructure or from closing the loop, I guess people call it, and how important that is.
[00:19:44] [2] Like, I would have just, like, kind of dived in and started working and been able to maintain code quality if I was doing it manually.
[00:19:50] [2] But, like, very quickly, the AI was just, like, dishing out slop. And I needed to just come up with this custom framework for, essentially, writing unit tests of key bindings and stuff like that.
[00:20:04] [2] I mean, it's not really a custom framework. It was just, like, really, it was just, like, explore this state space and make sure that whenever you make a change, it's intentional.
[00:20:12] [2] And, like, did the AI, I mean, it helped the AI, but it would still make these massive changes and not actually review them.
[00:20:18] [2] So whatever. Okay, so after that, I did what everybody else wanted to do, I think, which is
[00:20:26] [2] decide that I wanted to build a pipeline where one agent identifies refactors and then a bunch of other agents, maybe in parallel or something, implement them.
[00:20:36] [2] And, like, the first times I did that, like, it was just kind of bonanza. It was, like, kind of bananas.
[00:20:41] [2] Like, they would not commit their changes no matter how much I asked. There was, like, one file which was being used as sort of the just to store everything.
[00:20:52] [2] And, like, okay, so I had some pretty bad primitives, and, like, it would have been a lot better if I just, like, used a database or something for these tasks, which I did not.
[00:21:01] [2] But it became very quickly clear to me that what I needed or what I wanted was this, like, a workflow and, like, a DAG.
[00:21:13] [2] And
[00:21:15] [2] so I ended up
[00:21:17] [2] building this sort of, like, this JSON-based workflow tool. And at the time, it was using a bunch of agents which were long-lived that would read from some sort of, that would call this binary and that would give them tas
[00:21:32] [2] ks whenever they were ready to have a task. I didn't really, I hadn't worked out how to run Claude-P quite yet.
[00:21:40] [2] Plus, I think, like, I was doing this mostly for work stuff. And we have, like, an interesting setup at work.
[00:21:50] [2] And running Claude ephemerally like that was not one of the blessed workflows, so at the time I needed that.
[00:21:57] [2] This turned into, like, a JSON builder pattern. So I realized that, like, it's just better to build this stuff in TypeScript.
[00:22:05] [2] You have more type safety. Like, the JSON stuff was very stringly typed. Like, I could enforce the shape right, but, like, if you're saying the next step is X, you don't really have any guarantee that X actually exists.
[00:22:16] [2] So that turned into, essentially, a couple steps further into, okay, now we have this JSON builder pattern, but, like, what are we actually building?
[00:22:25] [2] Well, we're building a workflow. Okay, so now instead of building the workflow directly, you're sort of building an, I mean, that's basically an AST.
[00:22:33] [2] And that turned into, now we should execute this AST as if it's actually a programming language.
[00:22:41] [2] And that ended up being Barndum. So the gist of Barndum is that you have, it's a DSL in TypeScript where you write some stuff that hopefully looks like intuitive TypeScript.
[00:22:52] [2] It looks a little bit like a fact. That generates an AST that gets serialized and sent to a Rust process where it's executed or interpreted, I guess, maybe, if you're being super
[00:23:04] [2] persnickity. And on the Rust side, we execute the AST and sort of, like,
[00:23:15] [2] schedule a bunch of async stuff and what have you. And one of those async tasks is invoking an LLM.
[00:23:23] [2] And so the idea here is that Barndum h
[00:23:28] [2] as, like, has four, I think, goals is how I usually think about it. One is it should be really easy to invoke LLMs from it.
[00:23:35] [2] That's kind of trivial. I mean, that's true of everything. So the three real ones are, one, it's kind of high-level and focused on control flow and type safety.
[00:23:44] [2] Two is that it makes it really easy to
[00:23:49] [2] handle parallel work and asynchronous work. And three, it is really easy for agents to write, because ultimately, and I think if you have those three things, then what you have is the ability to essentially do something
[00:24:04] [2] similar to Code Mode, the Anthropic thing that I guess was just a couple weeks old now, where the first step is you describe the problem or something like that, and the agent builds a program, and then that program is inv
[00:24:16] [2] oked, and it in turn calls a bunch of LLMs. And that is how you get to do several things.
[00:24:23] [2] One is you constrain the behavior of the LLMs. So, for example, if the LLM, if you're just asking an LLM, "Hey, one-shot this feature," and there's a hundred different sub-decisions that you have to make, like, good luc
[00:24:35] [2] k. It's going to make bad decisions. It's mostly going to make lazy and easy decisions rather than really holding itself to a high bar.
[00:24:44] [2] And
[00:24:45] [2] secondly, it's going to be expensive because
[00:24:49] [2] it's going to do stuff like list all the files in the repo. And then, I mean, let's say you have a thousand files.
[00:24:54] [2] Well, that's a thousand files that are now in context. And then it's going to marshal those into a JSON thing to print out or something like that, right?
[00:25:01] [2] Like, that's, like, multiple times that these strings go in and out for no reason.
[00:25:05] [2] And listing all the files in your repository, that's the kind of thing that you should be able to do just using, let's say, JavaScript.
[00:25:17] [2] So that's the idea behind Barndum. It sort of allows you to constrain the agents, and by doing that, you have more reliability, and they're cheaper because you're not doing stuff that you shouldn't be doing with agents in
[00:25:27] [2] the agentic world.
[00:25:30] [1] Awesome. There's one thing that I want to kind of talk about before we get into actual code examples.
[00:25:37] [1] Could we define Code Mode? Dev, I saw you tweeting about Code Mode also. I've seen other people talk about Code Mode.
[00:25:44] [1] I'm not up on this yet. I'm more of a Codex user than a Claude Code user, so enlighten me.
[00:25:49] [1] What is Code Mode?
[00:25:52] [3] You want to take that, Robert?
[00:25:54] [2] No, you go for it.
[00:25:55] [1] I'll be curious for both your takes, so.
[00:25:57] [3] Okay, the way that I think about Code Mode is basically that, like, currently agents call, like, one tool, wait for the result, then they call the other tool.
[00:26:12] [3] The best that harnesses are doing right now is parallel tools where models will, like, write multiple, like, three or four tool calls at once, then wait for all of them to finish and then take the next step.
[00:26:25] [3] Code Mode is essentially a way for a model to write some logic that invokes a bunch of functions,
[00:26:35] [3] like, basically uses tools as function calls within that script. And then, which means it can also combine, like, control flow, loops.
[00:26:46] [3] It can do, like, basic data transformation inside. So if you have a tool that returns a thousand things and an LLM can just write, like, okay, call this function and then do a dot filter and filter out everything that's
[00:27:01] [3] higher than or that's, like, have some predicate, basically. So instead of calling a tool directly, it writes code that will call a bunch of tools.
[00:27:11] [3] And then one of those functions could be triggering a sub-agent. So within that workflow, it can do additional things.
[00:27:16] [3] And the answer to why is that it's more token efficient. It's easier. A lot of tasks are pretty straightforward to, like, put together in a sequence.
[00:27:28] [3] Like, an LLM doesn't really need to do all the steps individually. It can just orchestrate them and only have to look at the final result.
[00:27:37] [3] And honestly, right now, like, I'm a heavy user of Hermes agent right now, and more than half of my Hermes tool calls are Python scripts.
[00:27:45] [3] And I would love to replace that with actual Code Mode.
[00:27:52] [3] That's my brain dump on Code Mode.
[00:27:54] [1] Yeah, so that.
[00:27:55] [3] So Robert can fill in what he did.
[00:27:56] [1] So then Robert, what I would be curious then to know is, so I hear a lot of things that overlap there.
[00:28:02] [1] So what makes Code Mode different from what you're doing?
[00:28:07] [2] Yeah. Well, I can go talk about a little bit about the differences, but I think that the key thing to answer the why question is that, like I said earlier, it's that if you are trying to get more reliability out of your
[00:28:22] [2] LLMs,
[00:28:24] [2] you don't want the LLM to be responsible for key things. So, for example, if your LLM can skip unit tests, can comment out unit tests or whatever before making PRs and landing PRs, then at some point in time, for a suff
[00:28:38] [2] iciently large task or a sufficiently large number of tasks, it's going to start cutting corners.
[00:28:43] [2] And on the other hand, it's fairly easy and sometimes really valuable to say, I would not like LLMs to skip unit tests.
[00:28:53] [2] You should never commit something that might.
[00:28:55] [1] Because they just didn't do that.
[00:28:57] [2] Yep. And the way that they can not do that is by having the LLM not be the outer layer.
[00:29:03] [2] So right now, if you're using an agent to do stuff, then the agent is the outer layer, and it can do whatever the hell it wants.
[00:29:09] [2] Huge advantage is that it's very flexible. It can kind of, like, adapt and whatever.
[00:29:13] [2] But on the other hand, if you have a task that you know what, you know the outlines of it, and it might be make this change and then run TypeScript, even something like that, doing that as a, like, in a programming lang
[00:29:28] [2] uage means that there is no agent on the outside that can just skip the TypeScript.
[00:29:31] [2] Like, okay, maybe the agent could, like, modify the file and then, you know, like, hack the mainframe or whatever.
[00:29:36] [2] You know what I mean? But, like, within, realistically, within the kind of stuff that it will do, it will not really, that prevents it from cutting corners.
[00:29:48] [2] That's the most important one. Now, you may think, ah, that's fine. Working with an agent directly is fine for all the things I want, all the things I do.
[00:29:56] [2] And that might be true. It's actually, most of the time for writing features, the proper way to do, the proper thing to do is to work with an agent because that kind of fits well.
[00:30:06] [2] And you're reviewing the code at the end of the day or at least kind of sort of looking at it.
[00:30:13] [2] And if stuff is
[00:30:15] [2] , if you have a human in the loop, then a lot of this stuff is not as high priority or high impact.
[00:30:23] [1] Because you're verifying it on a step-by-step basis because you're seeing what it gives you.
[00:30:27] [1] You're like, wait a second, you messed this thing up. You go tell it that. I will say an ad hoc way that I tend to deal with this is I just have an agent review another agent, but, like, not like you just have Codex rev
[00:30:38] [1] iew Codex. You have, like, Claude Code review Codex or, like, because then it will step outside of the context to actually review it.
[00:30:46] [1] But that's still then they could cut corners in the review. So that gets me part of the way there, but it's not, like, a real way of solving the problem like you're trying to do.
[00:30:56] [2] Yeah.
[00:30:59] [2] And so, yeah, so really it comes down to, like, what situations do we want to remove the human from the loop?
[00:31:04] [2] Okay, maybe you're doing some AI work as part of, like, an API, and you're, or you're just doing 10,000 refactors.
[00:31:12] [2] Like, those refactors might be converting a file from, I don't know, JavaScript to TypeScript or something like that, right?
[00:31:17] [2] Like, kind of annoying to do individually. Maybe there's a little bit of thinking involved.
[00:31:22] [2] But by and large, like, the task is
[00:31:26] [2] well-defined and not open-ended. So it's in situations like that where you want to use something like Code Mode or Barndum.
[00:31:33] [2] And both Code Mode and Barndum sort of fill a very, fill the same niche, I guess you could say, and they make very different decisions on how to do that.
[00:31:44] [2] But yeah, that's, I think, the gist.
[00:31:46] [1] Do we answer this, I don't know if we answer this question directly. Does this only make sense for background tasks?
[00:31:52] [1] I'm not sure exactly which part of the conversation he's even asking about here.
[00:31:56] [2] I think the, yeah, like, well, I guess I think it makes sense if it's an, if it's something that's, like, there's no human in the loop, right?
[00:32:04] [2] That could be a background task. It could be something that's part of an API. It could be automatically reviewing, you know, if you're doing something like reviewing code in response to an event without any human in the
[00:32:16] [2] loop. So I think the answer is yes, that background tasks fit for this. Not maybe not only for background tasks, but yeah.
[00:32:23] [3] I think we can make it much easier to understand with a demo of some sort if you have that set up.
[00:32:29] [1] Yeah, as you said, at this point, let's get into the actual start looking at some code here.
[00:32:33] [1] And also, I like that you said it's a TypeScript DSL because that was the one thing that going into this, I was like, I don't know any other programming languages.
[00:32:42] [1] So that will help.
[00:32:44] [2] Yeah. Actually, yeah, I think that that's, it's an on-purpose decision. On the one hand, like, English sucks or whatever vernacular you do sucks because you can't, it's not composable.
[00:33:01] [2] It's not clear what you're referring to. There's no equivalent of static type checking or anything like that.
[00:33:06] [2] Like, if you have an extremely well-written English language description of a task, you don't know that it is correct.
[00:33:13] [2] And it is never 100% correct. You have to run it to see what happens. And even if it runs correctly, you're not 100% certain that it is correct.
[00:33:22] [2] And, okay, so instead of using English or vernacular, you should use a programming language.
[00:33:31] [2] Why not use JavaScript? Well, JavaScript is really, it's really hard in JavaScript to write correct programs.
[00:33:39] [2] And in particular, the kind of stuff that you mostly want to do is it's kind of a DAG-like structure a lot of times.
[00:33:45] [2] And in particular, efficiently going through a DAG of parallel work is something that JavaScript is notoriously poor at, a poor fit for.
[00:33:55] [2] Okay, so why not use a completely different language? Haskell is really good at expressing that.
[00:34:00] [2] Well, if I told you that you should, you'd be better at writing AI if you wrote Haskell, that might be true, but also very few people would take me up on that offer.
[00:34:10] [2] So the missing last, the missing fourth option is a DSL inside of TypeScript that gives you different semantics.
[00:34:20] [2] So it looks more like effect, but it is in the lingua franca, both the lingua franca for humans and also the lingua franca for AIs.
[00:34:28] [2] So that's why Code Mode writes JavaScript, I think. And it's fine, like, and it's great because there's a lot of adoption of Code Mode relative to Barndum.
[00:34:42] [2] And that's fine, but I still think it's worse because of all the reasons
[00:34:49] [2] that, because it's just basically bare JavaScript. So you might, I, for example, played around with Code Mode a little bit, and I asked it to do something that basically had, like, three phases.
[00:35:00] [2] It would complete phase one entirely. Then it would start phase two. Then it would do phase three.
[00:35:04] [2] But, like, sort of the ideal way to do something like that is to imagine that it's a tree and that there's, like, little inputs that go into all the thingies, and you just kind of work on whatever task is available.
[00:35:15] [2] If you ask the agent to do that, maybe it will do that, but it will not naturally, but it doesn't naturally fall into that pit of success.
[00:35:22] [2] And so you end up with these, you end up with a lower ceiling for the performance than, or rather, it takes more effort to get good performance and stuff like that.
[00:35:34] [2] And I think the point of AI is that the happy path has to be the performant path if we're going to start to use it everywhere and really unlock the benefits.
[00:35:45] [2] Yeah, okay. So that's mostly my responses to parasocial fixes questions.
[00:35:51] [1] Understood. You want to start sharing?
[00:35:53] [2] Thank you for guiding the conversation. Yeah, so.
[00:35:57] [1] No, all good.
[00:35:58] [2] Yeah.
[00:36:00] [2] So should I share my screen is what you're saying?
[00:36:03] [1] Yes.
[00:36:04] [2] Yeah, okay. So let's do this.
[00:36:07] [3] And it's completely fine if the demo is, if it doesn't properly work first time or if it hasn't.
[00:36:14] [1] You can also show, like, the docs page if we want to just start talking about, like, concepts first or you can go straight into the demo.
[00:36:21] [2] I need to enable sharing. So I will be back in hopefully a matter of minutes.
[00:36:25] [1] That's for sure.
[00:36:28] [1] We got a question here about Beads. Have you ever used Beads Dev? It's like some orchestration tool.
[00:36:34] [1] It gets you a bunch of agents kind of working in parallel. Beads sounds interesting.
[00:36:40] [1] I've parasocial, I've looked into a couple of those orchestration tools. I haven't taken the dive on any of them yet,
[00:36:47] [1] but I feel like that's kind of where a lot of this stuff is going is higher level abstractions to get multiple agents kind of doing stuff in concert with each other.
[00:37:02] [2] Okay.
[00:37:04] [1] All right.
[00:37:05] [2] Y'all see my screen? Excellent.
[00:37:06] [1] Yes.
[00:37:08] [2] Cool. So as you can see here, I haven't actually done a lot of stuff in Icecraft for quite a while, but I created three PRs today.
[00:37:18] [2] That's what.
[00:37:18] [1] Look at you.
[00:37:19] [2] That's so productive. Oh my goodness. And.
[00:37:23] [1] You read X.
[00:37:24] [2] Yeah. That's fine.
[00:37:28] [2] These are not good PRs. The point is all these PRs did was add a bunch of eprint line comments at the top of files.
[00:37:38] [2] And
[00:37:41] [2] they're actually doing a poor job of this because they didn't, I guess I didn't include to reset hard the repository or something like that, and it kind of, like, swallowed a few into it.
[00:37:52] [2] Or some stuff was running in parallel. Who the hell knows? Yeah, this one only has one file.
[00:37:56] [2] It's only supposed to modify one file based on the description. Okay. So this is our goal is to make a bunch of automated refactors.
[00:38:05] [2] Actually, I'm going to limit it to one file at a time because it doesn't really help.
[00:38:09] [2] It doesn't really help. But, like, this runs in parallel by default. Okay. So I actually do this at work a lot.
[00:38:17] [2] And one of the things that I've done is
[00:38:22] [2] I listed something like 26 possible refactors that I think don't change behavior and are good to do almost in every, in any file where we can find them.
[00:38:34] [2] These could be simple. These are things like, I don't like the use of two pipes to, instead of two question marks because two question marks is more clearly saying this is the default value.
[00:38:46] [2] And so I have one description of a refactor that is that. Other ones are like, hey,
[00:38:53] [2] there are some impossible states. There are some representable impossible states.
[00:38:57] [2] Okay, so there's, like, a loading Boolean state variable. There's also a nullable promise value variable that's in state and an error.
[00:39:07] [2] You know, you can't have all three, you can't have error and the OK value at the same time.
[00:39:12] [1] Include question. So are all 26 of these ones you came up with yourself or did you do an analysis also with the AI to help find them?
[00:39:21] [2] I think I just mostly picked the ones that I care about.
[00:39:25] [1] So you went through your, and actually wrote these all out to then direct it what to do.
[00:39:30] [2] It's both. One, I described them and then I had the AI turn that into descriptions of the refactors to do, and then I would sort of read them and go back.
[00:39:39] [2] I think the key thing to note is that
[00:39:46] [2] you want to bootstrap what you're doing.
[00:39:49] [2] You don't really want to write the code yourself if the code is Code Mode. Like, instead, you should just go back and forth with an AI, and then that will, like, expand that out until, like, exactly the thing that runs,
[00:39:58] [2] and you sort of examine it and you're like, hey, you made a bug here, whatever, and then you sort of go from there.
[00:40:03] [2] Same thing is true of Barndum. Same thing is true of writing these refactors that we're going to do.
[00:40:09] [2] But yeah, there's, like, 26 refactors ranging from really small to actually pretty big changes to ones that sort of involve looking at many files at once.
[00:40:18] [2] So, for example, is every single prop that we have for every component, like, actually passed somewhere?
[00:40:25] [2] And if not, can it be, are all the possible values passed? So are all the variants passed?
[00:40:31] [2] So, for example, we might accept a string, but it can only be two possible concrete values.
[00:40:36] [2] One of the refactors will change that to the type, will make the type only those concrete values.
[00:40:41] [2] Okay. But, like, the point is I've done that, and I've, that way, shipped hundreds.
[00:40:47] [2] I'm not exaggerating here. I've shipped hundreds of PRs that just do that. And they have never, as far as I know,
[00:40:54] [2] broken anything except for in one particular case where TypeScript was lying, and then I sort of updated the refactors to handle that case.
[00:41:05] [2] And yeah, so that's kind of cool.
[00:41:09] [1] This is super interesting to me because I've been on this contract for the last, like, seven months now, and I'm working for a very large payroll company to basically, like, teach their developers how to use AI coding to
[00:41:22] [1] ols. And I do a two-week workshop for them, and, like, three quarters of it is based just around refactors and, like, finding refactors and making refactors and doing exactly what you're talking about.
[00:41:34] [1] So, and I think, and I've been doing that a lot on my own projects. So when I first heard you, when I first read the description, it says, like, you know, this project is for, like, shipping hundreds of PRs a week or som
[00:41:45] [1] ething like that. I think most people in their mind, they think, you know, like, 100 feature PRs.
[00:41:50] [1] You know, they don't necessarily think, like, this is 100 refactor PRs. And so I think the first question would be, like, why would you need to make that many refactors?
[00:42:00] [2] The code base is large, and there's a lot to improve in the code base. Like, I think that there's actually, so yes, most people think about using AI to ship new features.
[00:42:13] [2] And I think this is a poor fit for using AI to ship new features. Well, at least, like, the refactor part of it.
[00:42:19] [2] Because
[00:42:22] [2] you're not doing the same task repeatedly if you're shipping new features. It's more like you're kind of ideating and figuring out what's the best architecture for this thing.
[00:42:29] [1] It really requires a human in the loop. Whereas what you're looking at, you're finding the space in which it can do a lot of this work independently of a human having to constantly, because if you had to check every one
[00:42:39] [1] of these refactors, that's just completely out of the question.
[00:42:43] [2] Yes.
[00:42:45] [2] And so I still use it for, like, making changes when I have a human in the loop.
[00:42:51] [2] So, for example, I actually did, I had, like, 60 stacked PRs, it's 60, 70 or something like that, to refactor one of our main surfaces.
[00:43:01] [2] And basically, I wanted to break it up into smaller parts and do all the things that you would expect to do in a general cleanup of this thing.
[00:43:09] [2] But that was very human-driven. But in the end, like, I had 60, whatever, stacked PRs, and I ended up using Barndum, the second half of what I'll show you, to babysit those PRs, rebase them until they pass, and
[00:43:25] [2] rerun the failed things that are flaky, and then essentially land them as needed.
[00:43:31] [2] And that was cool because, like, that's actually, I'll talk about that later, but I think that the key thing, the cool thing about that is that
[00:43:40] [2] it's a convenient way to write it, and you'll look at the logic that's in the babysitting thing, and you'll see that, yeah, that, like, all of that stuff kind of makes sense.
[00:43:49] [2] Like, you do need to categorize the PR, and then you do need to do one or the others.
[00:43:52] [2] And, like, writing that in English, like, it won't be done reliably. And I did try to get LLMs to rebase PRs and land them for me, and, like, half the time it would just get confused about what the diff is and be like, he
[00:44:05] [2] y, this PR is empty. Like, let me just close it. And then I was like, I'm not paying attention, so I wouldn't notice, but some changes just wouldn't land.
[00:44:13] [2] And that's silly. Like, LLMs are bad at a lot of stuff. They're great at some things, but they're also bad at doing the thing that you need them to get right reliably.
[00:44:25] [2] Yeah. So, okay. So there's two aspects to Barndum that I want to show you. One is the generating the PRs, and then one is the babysitting.
[00:44:32] [2] And then there's, I'm not going to show you the babysitting in, actually, I'll just, I'll look at the code, but we won't see it doing the rebasing because.
[00:44:40] [1] Yeah, all good. Yeah.
[00:44:41] [2] Whatever. There's no, the open source, there's no CI, basically. Just as long as tests pass, I can merge them, and I usually merge straight to master.
[00:44:49] [2] Okay, cool. So let's take a look. So.
[00:44:54] [1] You can continue on. I'm going to just hop off screen for one minute to go refill my drink, but I'll be listening.
[00:44:59] [2] Yeah. Cool. Okay. So here is Barndum. Barndum-circus.github.io. For folks who want to check it out, would definitely recommend it.
[00:45:10] [2] The nice part about this is that there is a quick start. And if you just point the LLM at this quick start and sort of tell it what to, tell it that you want it to do that, it does a decent job of writing a refactor.
[00:45:24] [2] And that's how I built, I mean, a Barndum workflow, and that's how I built most of these.
[00:45:29] [2] Okay. So what does it feel like to write Barndum? Well, basically, you are doing something like this.
[00:45:36] [2] Oh, this is actually, hopefully the current docs are up to date because I want to be using the latest.
[00:45:45] [2] Yeah. This is what it looks like. So, for example, you call listFiles.iterate. For each of those, you migrate a component, and then you collect it, and then you run it.
[00:45:55] [2] And this, and what will this do? ListFiles here is something that returns an array.
[00:46:03] [2] We're going to iterate on that, and then we're going to call migrateComponent. That is something that takes an item in the array, and it's all fully statically type checked.
[00:46:10] [2] What actually happens here? This generates a description of a program, an AST, that gets serialized, sent to this Rust process.
[00:46:20] [2] That Rust process sort of executes it maximally parallelly. So this is a parallel iteration, for example.
[00:46:27] [2] And then
[00:46:30] [2] it finishes, and that value is sent, is serialized back to JavaScript, and when we await this value, we
[00:46:39] [2] will get the result of doing that.
[00:46:42] [2] And then you sort of run this JavaScript like you normally would, and it kind of does the right thing.
[00:46:48] [2] Okay. So what is listFiles here? Or migrateComponent. What is migrateComponent?
[00:46:51] [2] Well, migrateComponent here is a handler. So handlers here are essentially just chunks of code that can do whatever they want.
[00:47:03] [2] In this case, it, I mean, it doesn't really do anything. It logs something,
[00:47:09] [2] and it says that it didn't migrate it. It's, like, kind of a useless, kind of a useless little stub.
[00:47:14] [2] But the point is you can do whatever you want here. You can read the file. You can call Claude.
[00:47:19] [2] You can invoke Codex, whatever.
[00:47:23] [2] And so
[00:47:25] [2] Barndum essentially allows you to glue a bunch of things like this together and do what you actually want to do.
[00:47:33] [2] So let's take a look at
[00:47:37] [2] ref2, which is what I call the refactory, and take a look at process.
[00:47:43] [1] Do you increase your font by just one or two?
[00:47:45] [2] Absolutely. I can.
[00:47:47] [1] That's great.
[00:47:48] [2] I'm blind as a bat too, and I appreciate it larger than that even for myself. Okay.
[00:47:55] [2] So, for example, we might call extractionConsumer. extractionConsumer here is going to
[00:48:01] [2] , it's going to loop, and it's going to find these refactors, and then it's going to put them in a queue.
[00:48:07] [2] And
[00:48:08] [2] let me actually
[00:48:11] [2] dive into what this actually looks like when I run it. So if we take a look at ghostT, okay, so first thing I'm going to do is I'm going to clear the state out of this thingy, and then we're going to run it.
[00:48:23] [1] You're fine on your terminal now?
[00:48:24] [2] Yes, yes, yes, yes, yes, yes. Okay. And now I'm going to run it. So I'm just going to invoke some sort of JavaScript, and this happens to end up invoking the pipeline.
[00:48:35] [2] But, like, there's, like, you know, it's whatever. It's a CLI. It does some other stuff.
[00:48:39] [2] And I point it to these refactors, and this is literally how I use it at work and also how I'm going to demonstrate it here.
[00:48:45] [2] And we're going to run it. And what is this going to do? It's going to reset the queues.
[00:48:51] [2] All this logging, I'm just doing myself. It's just calling functions. And then Barndum sort of
[00:48:58] [2] queues them together.
[00:49:01] [2] And when it gets going, I'm not sure why it's taking slightly longer, it's going to start invoking LLMs.
[00:49:08] [2] And one of the things that it's going to do is, for example,
[00:49:13] [2] well, I'm just sort of very verbosely logging the heck out of all this stuff. And you'll see that, like, one of the things the LLM said is, hey, the refactor has been successfully applied.
[00:49:23] [2] All seven print line statements have been inserted and blah, blah, blah. Okay, cool.
[00:49:27] [2] So it's actually doing that.
[00:49:30] [1] So it's logging back its own chat responses.
[00:49:33] [2] Yeah, exactly. I just happened to do that. So nothing about this really.
[00:49:37] [1] Well, because if you were vibe coding this project itself, you'd want those logs to be fed back into your agent that is creating the project itself.
[00:49:44] [2] Yeah.
[00:49:46] [2] So really all I'm doing is, let me see, it's call -p maybe. Is that what you're supposed to do with Claude?
[00:49:52] [2] Is it claude-p? Is that what we do? Yeah, here we go.
[00:49:55] [1] For programmatic access, yeah.
[00:49:57] [2] Yeah. I'm literally just doing this. I'm writing some sort of file, and then I'm executing that file, and that file happens to contain claude-p.
[00:50:07] [2] Okay. When I execute this, I take a look at this and, you know, the output, and then I stream it to standard out.
[00:50:15] [2] So it's, like, nothing, not really anything special.
[00:50:18] [1] It's a CLI. Like, you built a CLI.
[00:50:20] [2] Yeah.
[00:50:21] [1] This is great because everything I'm building right now with AI is exactly like what you're doing right now.
[00:50:25] [1] It's exactly the type of crap I'm building, which is the CLI piping all this different stuff together, you know?
[00:50:31] [2] Yep. Okay. So I don't actually usually log this amount of verbosity because it's kind of ridiculous.
[00:50:38] [2] But, like, the point is it does a bunch of stuff, and then eventually this will finish.
[00:50:41] [2] This is sort of the extraction part. Wait, no, this is implement now. So now it finished extracting the refactor, and then it will implement it.
[00:50:50] [2] And cool. It created a draft PR here, and let's take a look at this.
[00:50:56] [1] So does this have.
[00:50:57] [3] Can you explain what you mean? Sorry, go ahead.
[00:51:00] [1] I was going to say, so does this have, like, a GitHub token or, like, you haven't given permissions?
[00:51:04] [1] Like, how is it connecting to, or I guess Claude Code is just doing that.
[00:51:09] [2] Claude Code is just, well, no, I'm just calling GitHub or GHPR create or whatever, essentially invoking some sort of.
[00:51:16] [1] So you're running the GitHub CLI also?
[00:51:18] [2] Probably. Probably. Yeah. Yeah.
[00:51:20] [1] Great.
[00:51:21] [2] I say probably because, again, everything is sort of bootstrapped together with me and the agent working together.
[00:51:28] [1] Yeah.
[00:51:28] [2] So excellent work. It created a perfect PR doing exactly what I wanted it to do.
[00:51:32] [2] It's very, very impressive. So actually, let's take a look.
[00:51:36] [1] I have a question before we continue on.
[00:51:38] [2] Yeah.
[00:51:39] [3] Sorry. Yeah. I was just wondering, what do you mean when you said extract a refactor before implementing it?
[00:51:46] [2] Sorry. That is, why does this not,
[00:51:53] [2] what I mean is that there's one process that loops over a bunch of input files.
[00:51:59] [2] So we have these input files. There's only one here in this input. Normally, I would have every single file in the repository.
[00:52:05] [2] There's one process, one thing that loops over each of these files, analyzes them for potential refactors.
[00:52:12] [2] So in this case, this is the refactor. I don't know how to do word wrap.
[00:52:18] [2] No, it's not there. But, like, you know,
[00:52:23] [2] it says add eprint line, and I basically send this to Claude, and then I have a whole bunch of stuff around it.
[00:52:29] [2] So, for example,
[00:52:32] [2] at work, I don't actually know what happens here. This was vibe adopted in order to work with Isograph.
[00:52:39] [2] Like, at work, I have a bunch of stuff that it attempts to run. So, for example, make sure that TypeScript passes, make sure that lint passes, and so on and so forth.
[00:52:48] [2] And then there's other agents that will re-review it to make sure that nothing is in a broken state or we didn't do any, we didn't cut any corners and stuff like that.
[00:52:58] [2] But I'm being a little bit vague here, right? Because the point is, like, it's a programming language to do whatever the hell you want, and I just happen to be doing that.
[00:53:06] [2] But I think that the bigger point is, like, what actually does it feel like to do this?
[00:53:12] [2] Oh, okay. So let's see. Reference.
[00:53:14] [1] Also, I wasn't seeing these comments in the chat. I think we kind of answered this.
[00:53:18] [1] How do you actually drive the LLM? You're doing it via the CLI agent, not via the API.
[00:53:25] [2] Yeah.
[00:53:25] [1] I think you say it's called softwrap instead.
[00:53:29] [2] Oh, I think I'm looking at, I might be looking at an old version. It's okay. Okay.
[00:53:33] [2] Softwrap. Thank you. Thank you. Oh, wonderful. I just started using Zed and ghostCTY on, I figured it's time to upgrade.
[00:53:45] [2] But yeah, essentially what I'm doing is this. When I run the CLI with process, right, like, or when I run it, I'm running this, and this calls run pipeline.
[00:53:54] [2] I think this is outdated. It should just be not run. But I might be on an old version.
[00:54:01] [2] I guess I probably just haven't pushed the latest.
[00:54:03] [1] The minutia is not super duper important.
[00:54:05] [2] Fair. Fair, fair, fair. Okay. So, and then this will run this thing, and then it will run this thing, which is the second thing here.
[00:54:13] [2] And this one
[00:54:16] [2] will run these in parallel.
[00:54:19] [2] And the extraction consumer and the implementation consumer we were just talking about earlier.
[00:54:24] [2] So in particular, the extraction consumer
[00:54:29] [2] will loop. It will dequeue a file from the queue, and if it finds a file, it will run this some branch.
[00:54:41] [2] If it doesn't, it will just sleep, and then
[00:54:45] [2] it will recur. But it probably shouldn't because if you're done with files, you're done with files.
[00:54:53] [2] So I think that that's, like, we probably don't need to have this outer loop. But this is a loop.
[00:54:58] [1] I was going to ask about the loop, so because I'm just talking about loops right now in the AI world.
[00:55:02] [1] So is this leading into that loop-based workflow, or is this just an incidental loop?
[00:55:07] [1] This is not super important.
[00:55:10] [2] I have opinions on how loops are done. Like, loops are a very simple primitive, and it's bananas to me that
[00:55:20] [2] Claude is like, hey, you can run stuff in a loop, and it's this amazing feature.
[00:55:25] [2] When we have programming languages that have loops, they have many types of loops.
[00:55:30] [2] They have loops with conditions.
[00:55:32] [1] I love that.
[00:55:33] [2] It's just kind of weird that we're, like, doing that, that, like, loop and goal are these, like, amazing primitives.
[00:55:41] [2] Like, this is silly. Like, programming languages are just better ways of expressing that.
[00:55:46] [2] And
[00:55:48] [2] that allows you to corral the logic that the LLMs are doing into sort of, like, subparts and thus get more reliability and so on and so forth.
[00:55:57] [2] They just don't need this stuff in LLMs. Anyway, so that's, I think that's my overall opinion here is that this is a better way to write things.
[00:56:06] [2] Okay. So what do we do? Dequeue file.
[00:56:10] [2] Okay, nice. GD does go to definition. That's not that bad. It's a handler, like we just described, which is, say, it just does some arbitrary stuff.
[00:56:20] [2] And in this case, it probably looks at the list, like some folder of files, and it kind of uses that as a queue.
[00:56:27] [2] And then if we find one, then, yeah, you know, I'm pretty sure I have an updated version of all this stuff that looks better.
[00:56:36] [2] And I, so this whole time, I'm going to be trying not to talk about how I accidentally.
[00:56:43] [1] You want to taste the wrong version.
[00:56:45] [2] No, it's fine. It's fine. It's fine. No, no, it's fine. It's fine.
[00:56:51] [2] Okay. So,
[00:56:55] [2] and now we're just sort of, like, describing some sort of workflow. So we get this claimed file.
[00:57:02] [2] It's a reference to essentially something that has this shape. We don't ever get this shape in JavaScript.
[00:57:08] [2] This is, like, all on the Rust side. And the Rust side will call this kind of stuff, and it will do this, and then eventually we'll loop over each of the refactors, and we will essentially call
[00:57:24] [2] this thing, and this will, sorry, I'm going to make this slightly smaller because I'm very bothered by the, there we go.
[00:57:31] [2] Okay. At least it kind of looks a little nicer now. Is that still big enough, folks?
[00:57:35] [1] That's perfect, yeah.
[00:57:36] [3] That's good.
[00:57:36] [2] Okay, cool. Yeah.
[00:57:39] [2] So it'll bind this, and then what do we do? We'll call extractRefactors and extractRefactors.
[00:57:46] [2] What does it do? Well, it reads the file, and then it calls Claude, and it expects some sort of array value back.
[00:57:53] [2] But that's not really what's important. What's important is that
[00:57:58] [2] this thingy will make sure that you have that Claude returns this schema of
[00:58:08] [2] some sort of JSON that returns this zod, that upholds this zod schema. And so, okay, so that's going to be something I refactor name, what locations to change, a change summary, a motivation, guarantee.
[00:58:19] [2] I don't even know if, like, this is necessary. It's, like, maybe just these would be necessary, but whatever.
[00:58:24] [2] It's all vibe coded, and it works. That's the important part.
[00:58:29] [2] And, okay, references. Find all references. G-Shift-A. Man, this is, like, weird.
[00:58:38] [2] I'm still learning.
[00:58:39] [3] You can just have your VS Code keybinds instead, if that's what you're more familiar with.
[00:58:44] [2] Yes. I have a lot of custom keybinds. Okay. You know what? I'm already lost. Okay.
[00:58:51] [2] So we extract the refactors, right? And that gives us an array of items, right?
[00:58:55] [2] And then we're going to call advance or finish.
[00:59:01] [2] So this is another handler, and I think it seemed to have changed something or other somewhere because now everything's, we just tried undoing things.
[00:59:09] [1] It seems like it's a relatively small amount of code for the overall project.
[00:59:14] [2] Yes.
[00:59:18] [2] And the point is, okay, so, I mean, I could continue running through this, but, like, it's not really, like, particularly interesting code.
[00:59:25] [2] It, like, does what you expect. Conceptually, we have a list of files. We have a list of refactors.
[00:59:31] [2] We create a cross-product of those. For each of those, we run an agent to say, like, hey, please read this file and tell me whether this refactor exists or whether any number of these refactors exist in this file.
[00:59:44] [2] If so,
[00:59:46] [2] generate essentially a set of instructions. And then somewhere later, this will advance or finish, blah, blah, blah, and then we will get to, let me find
[00:59:59] [2] .
[00:59:59] [1] Okay. So I'm totally with you on all of this. My one big question right now is you've mentioned that it looks at a single file for these refactors.
[01:00:08] [1] That seems like it would be fairly limiting then in terms of the overall types of refactors you could do.
[01:00:17] [2] It focuses on one refactor, one file at a time, but it's an agent. It can do sort of whatever it wants.
[01:00:23] [2] So it will read other files.
[01:00:25] [1] It can change a bunch of files all at the same time.
[01:00:30] [2] Maybe I even.
[01:00:31] [1] I guess I just look at it this way. Like, how the common refactor you might see would be, like, an overly long file that needs to be broken up into, like, five modules, you know, something like that.
[01:00:40] [1] So is that the type of thing it could do or that is just.
[01:00:42] [2] Oh, it can.
[01:00:43] [1] It can.
[01:00:43] [2] Yeah, yeah.
[01:00:44] [1] Okay, great. Yeah, that was my big confused part here, but.
[01:00:47] [3] I think one other, I think one other example to maybe put what, explain what maybe Anthony was trying to say is let's say I have a file where, and it imports, like, three other files, and to determine if a certain refac
[01:01:02] [3] tor is needed, I also need to go and look at those three other files. But I might also have other, maybe I have other agents looking at those files as well.
[01:01:11] [3] So I guess, again, because you're just calling Claude here, you can tell, you can
[01:01:18] [3] prompt Claude, like, and ask it, like, hey, does this file need this refactor? And Claude is, yeah, Claude has the read tool, which means it sees the file, and then it can go ahead and read other files from the code bas
[01:01:32] [3] e, and it can easily figure out that, hey, this is needed or this is not needed, basically.
[01:01:39] [2] Yes.
[01:01:40] [3] Was right.
[01:01:41] [1] Yeah. And then my follow-on question for that is that what are his heuristics in terms of what requires a refactor versus not?
[01:01:50] [1] Because it's a slightly subjective thing.
[01:01:54] [3] Yeah. I think those things would be, like, things that you explain in your refactoring description.
[01:02:00] [3] Like, these are the decisions.
[01:02:01] [2] Right. Because you're starting by explaining what the refactor has to be in the first place, so it doesn't have to make that decision.
[01:02:07] [2] Gotcha. Yeah. Exactly. It's just, like,
[01:02:12] [2] in practice, these extraction instructions that I have are sometimes really short.
[01:02:18] [2] Like, the question mark, the two pipes to tuple question mark, pretty simple. It's, like, change it always.
[01:02:27] [2] Make sure it doesn't change any behavior. If the left side is a string that could be empty, like, be careful, whatever, that kind of stuff.
[01:02:34] [2] And other ones are, like, multiple pages of descriptions. So, for example, I have some that essentially adopt the relay migration API, which is kind of akin to adopting relay.
[01:02:46] [2] And that's, like, it's
[01:02:49] [2] essay, multiple essays worth of, like, here is the correct pattern. Here is the, and if I could break that up into smaller parts, I think it would have been worth it.
[01:02:59] [2] But, like, right now, I think the best way to use Barham in its current state ends up being a very detailed description of exactly the refactor that needs to happen.
[01:03:11] [1] Yeah. I'm also getting the message that these refactors are not just simplifying your code base.
[01:03:16] [1] They are, like, you're talking about bringing on GraphQL versus not, which is, like, that's a different type of refactor from, like, I'm trying to cut down on tech debt, you know?
[01:03:24] [2] Yeah, exactly.
[01:03:25] [3] Yeah. One example that I'm working on right now is, like, I'm trying to migrate a bunch of SoloJS projects to Solo 2.
[01:03:32] [3] 0, and there's, like, a bunch of RFCs that.
[01:03:35] [1] This would be really good for that, actually.
[01:03:38] [3] Exactly, yeah. Because some of them are, like, simple enough, like, you just rename a function, and it mostly does the same thing.
[01:03:47] [3] But some, like, there might be some few cases where just renaming the function is not enough, and you need to do additional things.
[01:03:54] [3] And there's a few APIs that have completely changed, and so some of them have, like, a really complicated decision tree almost, and you have to look at a bunch of files.
[01:04:06] [3] So obviously, if I take all of these RFCs, dump it into a single Claude session, and say, go and refactor this app, I don't expect that to work in a million years.
[01:04:16] [3] Maybe Mythos can figure that out.
[01:04:18] [1] I tried that. You're correct. It didn't work.
[01:04:21] [3] Exactly, yeah. But, and this is kind of what I eventually landed on, was that take, like, a bunch of individual refactors that need to happen and kind of explain, like, different scenarios in detail, and then split them
[01:04:36] [3] across different Claude sessions or different, like, LLM sessions. Like, okay, I am going to run one session that just goes and looks at all the create effect usage and just marks the ones that need to be migrated or that
[01:04:50] [3] need to, like, how they need to be migrated, and then have
[01:04:57] [3] a different session that then goes in again and actually does the refactors. So there's, like, a lot of different
[01:05:04] [3] kind of optimizations that you're doing. The first is that you're only, you're giving agents a very specific task of, like, looking for one kind of refactor, one kind of pattern.
[01:05:16] [3] And then the other thing is you're kind of splitting the concerns of identifying an implementation because if you have the same, the agent that goes and identifies refactors is going to have a lot of files in its context
[01:05:29] [3] that don't need to be refactored because it's, like, its job is to filter them out.
[01:05:34] [3] So the agent that goes ahead and implements them, it's not going to have any of that in context.
[01:05:39] [3] And it's, and I think the thing that we know about LLMs is that
[01:05:45] [3] the less context we use, the more performance or, like, the more correctness we
[01:05:52] [3] are, we can get out of them. And obviously, like, cost, like, instead of, like, 200,000 token sessions, you can be done, like,
[01:06:03] [3] you probably are going to have, like, 100, 200 agent sessions, but if all of them are, like, within 50K tokens, then it's probably much cheaper than, like, letting
[01:06:15] [3] Claude go or keep going on a task and compacting and then go, hits 200K again, compacts, hit 200K again, which is the worst way of looping, but that's the only way of looping that people have kind of been advertising so
[01:06:29] [3] far because the people who are advertising looping are model providers.
[01:06:35] [2] Yes. Actually, that's a really good point. I missed that earlier when I was talking about the litany of advantages is that because you can essentially tailor the invocation of Claude to something very narrow, it's liter
[01:06:47] [2] ally, read this one file and tell me whether this applies and return something with the following JSON shape.
[01:06:54] [2] Like, that's as, like, minimal, one, it's very, it's a good use of an agent because
[01:07:02] [2] the agent will
[01:07:07] [2] code mods, stuff like that, kind of difficult to use for something more complicated.
[01:07:11] [2] Okay, adding, like, an eprint line in the beginning of every function, like, yeah, we could do that with a code mod.
[01:07:16] [2] But, like, anything more complicated than this, then an agent is the perfect thing for it, but you also want to use it in as narrow and tailored way as possible.
[01:07:27] [1] This is only parasocial, like you said a while back, because remember code mods, the whole industry had just died because of LLMs.
[01:07:34] [2] Yeah.
[01:07:34] [1] Remember code mods were a big thing for Redwood because we would always want to create a very smooth upgrade path.
[01:07:42] [1] We would give all these code mods to upgrade your stuff, but it was just very complicated.
[01:07:50] [2] Yeah. So to answer your question earlier, so we can basically do whatever we want.
[01:07:53] [2] And if we wanted to just read the one file, well, then, you know, just change the allowed tools that you pass in.
[01:07:58] [2] And again, like, this is not some, this is not some magic API. It's just something I wrote, which ends up invoking Claude, and you can sort of do it however you want.
[01:08:06] [2] But what's nice about this extraction is it can't write any files. It can't do other stuff, at least potentially.
[01:08:13] [2] I don't really know whether, I think it will not do other stuff, at least hopefully.
[01:08:19] [2] So that's kind of cool.
[01:08:23] [2] Okay. So we extract the refactors, and then what we do is we put them in another queue, and then we call this implementation consumer, and that does sort of the reverse of that.
[01:08:34] [2] It reads from that queue and implements and generates a PR. And that's sort of more of the same.
[01:08:42] [2] And
[01:08:44] [2] I think the more interesting thing to look at is actually just this babysit thing.
[01:08:49] [2] So, for example, again, hoping that this is, yeah, this is good.
[01:08:54] [2] At some point in time, we need to
[01:08:58] [2] process one PR.
[01:09:00] [2] Let me see where this is. How do I, yeah, okay, cool. And that is cap, is that, that is called right after categorize PR.
[01:09:11] [2] So categorize PR
[01:09:14] [2] will, it's essentially a handler that returns some sort of
[01:09:19] [2] , man, I don't know how to, I still don't know how to go to definition. I didn't work though.
[01:09:26] [2] So we have this PR category schema, right? Okay. So it's, the PR is going to be categorized in one of five things.
[01:09:36] [2] Bypass automation, okay, if I need to force land it for some reason or it has been force landed, it needs to be retargeted because.
[01:09:45] [1] What do you mean by force landed?
[01:09:47] [2] Internally at Pinterest, we have some tags that you can use to force, to skip CI.
[01:09:53] [2] Okay. The point is, like, that's not, that doesn't matter.
[01:09:56] [3] Force is force.
[01:09:57] [2] Yeah, exactly. Okay. These are the ones that are more applicable. Okay. So maybe this is a stack of PRs, and now this PR doesn't point at master.
[01:10:06] [2] It points at a branch that has either landed or has been abandoned. So we need to retarget it.
[01:10:13] [2] We need to rebase it and then change the PR to target master. Needs rebase. Okay.
[01:10:19] [2] There's more than one commit in this branch, and we need to rebase it. So the parent commit has landed and been deleted.
[01:10:27] [2] Some sort of checks are failing or it's ready to merge or some sort of checks are still pending.
[01:10:32] [2] So there's, like, canonical things to do, right? And what do we call it? Categorize here.
[01:10:40] [2] So what do we do when we categorize the PR? Well, okay. I mean, it's the kind of thing that you would
[01:10:46] [2] expect. It's just some JavaScript function that's in a handler, and it does whatever you want, you know?
[01:10:51] [2] Like, it does things, and it returns values, and it checks if there are conflicts, in which case it needs a rebase and whatever.
[01:11:01] [2] The actual stuff here is not super interesting. What only matters is that
[01:11:09] [2] , let me, if I can find it, hopefully. I don't really know how to, I guess I could look for references.
[01:11:17] [2] Find all references. Oh, no, it's create handler. I didn't want that. I wanted categorize PR.
[01:11:26] [2] Yeah, okay. So here,
[01:11:29] [2] and then we ultimately call process one PR, right?
[01:11:33] [3] So does categorize PR call
[01:11:36] [3] an agent at any point, or is it all just procedural code?
[01:11:40] [2] I think that one probably doesn't invoke an agent.
[01:11:43] [3] Right. Okay. So it's also a good showcase of, like, a lot of times you can take a lot of work out of the agent's kind of plate.
[01:11:52] [2] Yes.
[01:11:53] [3] When you can just, like, if it's simple enough and you can express it deterministically, then why the hell not?
[01:11:59] [3] Like, why would you give an agent a task?
[01:12:02] [1] So obviously, you want to do that if you can.
[01:12:05] [2] Yes.
[01:12:07] [2] And then we process one PR, and
[01:12:12] [2] this has this fix failing checks pipeline.
[01:12:18] [2] And that does, that invokes an agent that will essentially look at what checks have failed,
[01:12:27] [2] preload those into context, maybe, and then tell the agent, like, hey, here's what happened.
[01:12:32] [2] Please fix it. And then actually, we might as well go to the definition of that.
[01:12:37] [2] So what is this going to do? It's going to check out the branch. It's going to run fixes.
[01:12:41] [2] And if it passed,
[01:12:45] [2] okay, actually, I do have a retry loop. I'm really on an old version of code right now for some reason.
[01:12:51] [2] That's fine.
[01:12:53] [2] This actually just loops several, some number of times and then retries. And what's nice about this is that there's actually, that's the kind of thing that you want control over.
[01:13:02] [2] I limit the number of retry attempts to something like three because if they have failed three times in a row, it's probably something is not going to be solved by throwing more tokens at it.
[01:13:16] [2] And the PR gets in this, like, sort of parked state where the agent just stops trying to fix it.
[01:13:22] [2] And otherwise, it will commit and push the branch. And that, as you might expect, just does a bunch of stuff in, like, you know, sort of deterministic land.
[01:13:33] [2] But yeah, the reason I wanted to talk about that, about, like, babysit was exactly like Dev said, like, the more you can move into the deterministic world, the better.
[01:13:45] [2] And also to just simply point out that categorizing a PR into those five things and handling each of those distinctly would be a nightmare to express in English.
[01:13:57] [2] And
[01:14:00] [2] on the other hand, it's actually quite nice and easy to express in what sort of amounts to a functional language.
[01:14:07] [2] And that is a huge improvement. And then, but then you want somewhere inside of this to be able to invoke an LLM.
[01:14:14] [2] So the moral of the story is that the outside should be a programming language, and that invokes LLMs on the inside.
[01:14:22] [2] And those should be as
[01:14:25] [2] simple and as light as possible.
[01:14:30] [3] Yeah, makes sense.
[01:14:31] [2] So that's spot on.
[01:14:33] [3] Yeah, oftentimes with agents, like, there are conversations about, like, inner loop and outer loop.
[01:14:39] [3] And yeah, what you're trying to say here is that a lot of times humans are the outer loop.
[01:14:45] [3] If I'm using Codex or Claude directly, I am the outer loop. Every time the agent does something and stops, I have to look at it and then go and trigger another session,
[01:14:55] [3] which, like, basically I am the bottleneck of how much work is happening, how many tokens I'm spending.
[01:15:05] [3] Yeah, you're not, sorry. If, yeah, but if that outer loop is something you can orchestrate, you can loop and you can keep, like, run over and over again, it gives you, like, a higher level primitive to define what kind of
[01:15:21] [3] work you want to do. I think this is kind of what Boris was talking about when he said that he doesn't write prompts anymore.
[01:15:30] [3] He writes loops. But I think what people miss is that, like, a part of the loop is writing the prompt itself.
[01:15:37] [3] So writing a loop doesn't mean you're not writing prompts anymore. It's just that you're writing prompts in a very different way where they describe a very specific small amount, like a unit of work, instead of, like, a
[01:15:50] [3] high level, go and do this thing.
[01:15:55] [2] Yes. I think that's exactly right. Like,
[01:16:02] [2] yeah, it's like we want to describe these workflows. Describing them with English is not going to get us to the reliability where you can actually remove humans.
[01:16:10] [2] But ultimately, what we're doing is describing these workflows. And I think that, like, people call that building loops, which is kind of silly, but
[01:16:20] [2] yeah.
[01:16:24] [3] Yeah, I think, yeah, one thing that I would love to get maybe some of your thoughts on is, like, I saw somewhere a while ago that,
[01:16:35] [3] like, agent orchestration is going to become, like, a concurrency problem. And I think this was kind of obvious in some of your, some of these workflows when there were, there was, like, a queue and you have to acquire a
[01:16:48] [3] file. Because if you have a bunch of things running in parallel on the same code base, it's basically like running multi-threaded programs with shared memory.
[01:16:59] [3] Like, there are a lot of similarities. This is why work trees are an important concept because it's basically like forking or forking memory
[01:17:11] [3] so that different threads can, I actually don't know too much about concurrent, like, multi-threaded programming and how that works.
[01:17:19] [3] I'm more of a, like, just have every thread just have its own little piece of state and then serialize messages back and forth, like kind of the Erlang model.
[01:17:30] [3] But what I saw a decent bit of in Barnum was, like, there's a queue and you have to acquire resources.
[01:17:37] [3] And so, like, what does that kind of look like? Like, how often are you doing work trees?
[01:17:44] [3] Where are you implementing work trees? I think that also becomes like a thing, like, how many work trees do you have at the same time for any project?
[01:17:55] [3] Yeah.
[01:17:56] [2] Yeah. So everything is sort of done in user land. Like, Barnum provides some, like, low-level primitives, but, like, it doesn't have a strong opinion on this sort of things.
[01:18:07] [2] However, you're right that, like, in practice, you do want to
[01:18:11] [2] , well, actually has a strong opinion that sort of everything happens maximally in parallel.
[01:18:16] [2] And so that means that, like, if you are trying to do a bunch of refactors at once, well, each thing needs its own
[01:18:24] [2] work tree or you need some way of limiting the number of refactors that are in flight at a time so that each one has a work tree that is available.
[01:18:34] [2] And yeah, I guess I don't have, like, a super deep answer here. I mean, there are some stuff within Barnum of how we do, like, parallelism on the Rust side.
[01:18:44] [2] But, like, you're absolutely right that essentially
[01:18:51] [2] everything is a parallel, everything's ultimately a parallel problem. And
[01:18:57] [2] I think the Barnum model makes sense here, which is sort of because everything is maximally parallel, what that means is that any work that is available to be done is being done.
[01:19:08] [2] And it's up to you to have
[01:19:12] [2] the chain, have the code that will essentially not proceed and do more work if there are not enough resources to do that work.
[01:19:19] [2] So do you want to run, like, more than five Claude codes even if invoked with -p at once?
[01:19:28] [2] Probably not. So there probably should be some sort of primitive that you have that, like, gives you access to a Claude code and limits that to five.
[01:19:39] [2] And Barnum could do a little bit better there. Right now, I'm sort of doing that in user land by essentially limiting their, limiting it to sort of two agents in parallel that generate the refactors and some larger number
[01:19:55] [2] of agents that, like, implement them. But in practice, the bottleneck is not that.
[01:20:01] [2] The bottleneck is, like, rebasing and landing. And, like, our CI
[01:20:07] [2] was not prepared, was not built to handle this sudden onslaught of hundreds and hundreds of PRs.
[01:20:14] [2] So I'm not super concerned about making Barnum as, like, making this workflow as performant as it possibly could be in theory.
[01:20:24] [2] So, and then there's another reason that I'm not, like, super concerned about that.
[01:20:29] [2] I think that the parallelism is important. I think correctness is important. But in the end, like, what are we doing?
[01:20:34] [2] We're invoking processes that invoke LLMs. And an LLM can take minutes at a time.
[01:20:39] [2] So, like, if you have, like, so the important thing is running stuff in parallel.
[01:20:43] [2] It's not, like, saving, it's not shaving milliseconds off of the invocation path.
[01:20:50] [2] Yeah, I mean, there's cool stuff I do on the Rust side, but in the Barnum workflow land, it's sort of you just do whatever you want.
[01:20:57] [2] And I happen to have some patterns that I think work well,
[01:21:02] [2] but I don't have all of the answers quite figured out yet. Like, this works for what I'm doing with it at Pinterest, and I should probably make it more usable in, like, a variety of other work, a variety of other circum
[01:21:16] [2] stances. But, like, in the end, like, it works well for what I'm doing, so.
[01:21:21] [3] Yeah, makes sense. And you won't know what works, what patterns work for other use cases until people actually start using it for those use cases.
[01:21:29] [3] So low-level primitives make sense until patterns emerge and you find certain things that can be built into the language that, okay, now here's a way to do the, to do something that everyone wants to do in terms of parall
[01:21:44] [3] el work.
[01:21:45] [1] I was going to ask you where the framework was going to go. So you guys literally just answered that before I could even ask it.
[01:21:52] [1] So that's great. I do want to make sure we have time for some of the isograph thing.
[01:21:57] [1] So I had just a couple of kind of wrap-up questions before we go on to that. It seems like this would be fairly portable if you were to do, like, Codex programmatically, OpenCode programmatically.
[01:22:10] [1] There's nothing really about Claude code that this is tied to right now. Is that correct?
[01:22:14] [2] Exactly. Exactly.
[01:22:17] [1] Cool. Then that's dope. So do you, have you experimented with those or for you, Claude code is working just fine?
[01:22:23] [1] You don't feel the need to try the other ones?
[01:22:26] [2] Claude code is working fine. Yeah, I've mostly, once I got it working with Claude, I wasn't super interested in for just for fun figuring out how to make it work with Codex.
[01:22:38] [2] But it should just be the same, right? It's just invoking some process, invoking it, and then enforcing that the LLM responds with some JSON that we can extract from some long stream of text.
[01:22:53] [2] Yeah. And also, like, I think to add on to where's Barnum going,
[01:22:59] [2] there's a few other things that I wanted to, that I want to achieve with Barnum.
[01:23:03] [2] For one thing, like, and this actually gets at why I think code mode is not ideal, is not ideally designed.
[01:23:10] [2] The way code mode works is that if something crashes and you reinvoke it, then you replay everything.
[01:23:18] [2] So you have this one file that, let's say, loops over a thousand files, does some work, and then processes it.
[01:23:25] [2] Okay, so we did 999 files and we failed to process the thousandth file. That is going to replay everything.
[01:23:32] [2] So it's going to reinvoke the LLMs, except it's not actually going to invoke the LLM.
[01:23:35] [2] It's just going to, like, pass the data in and it's going to pass it back. And then the JavaScript is going to do extra work and it's going to do other stuff, which is good.
[01:23:42] [2] But it, and that gives us the advantage that the code that you write in code mode just looks like plain old JavaScript.
[01:23:50] [2] But it has the disadvantage that
[01:23:54] [2] everything that touches the outside world has to go through an LLM. So earlier we were talking about listing all the files in your repo.
[01:24:02] [2] If you, if that goes through an LLM, man, like, you're just burning context. Like, that costs money to list all the files in your repo in order to, I don't know, find all the JavaScript files.
[01:24:11] [2] You can't do that with code mode, which is kind of bonkers to me.
[01:24:16] [2] And secondly, if you are doing a lot of work on the JavaScript side, for example, you list all the files in your repo and you filter them down, every time you replay, you have to redo that work.
[01:24:27] [2] And so that also means that the JavaScript has to be
[01:24:32] [2] not idempotent, it has to be pure. So no access, no, so obviously you can't access the file system.
[01:24:37] [2] That's why I have to go through the LLM. Two, you can't use stuff like Math.random.
[01:24:43] [2] You can't use stuff like newDate and so on and so forth. But, like, if you're using some external library and it happens to use Math.
[01:24:50] [2] random as part of one of its algorithms or it does some logging, like, it's going to just randomly break.
[01:24:55] [2] And that's not good. So code mode, like, it makes these decisions, which are, I think, make it easier to adopt at the expense of being the correct model.
[01:25:07] [2] Okay, so what does that have to do with the future of isograph, of Barnum, excuse me.
[01:25:12] [2] Isograph is my other project for folks on the call.
[01:25:15] [1] Yeah, we're about to get into. Yeah.
[01:25:16] [2] Yeah. This thing, it describes a workflow, but it is not actually executed on the JavaScript side.
[01:25:23] [2] So it is a data structure that is introspectable and it will
[01:25:30] [2] be executed by TypeScript. But that also means that every single stage in this execution, we know how, I mean, we know what it is.
[01:25:40] [2] So if you stop in the middle of a Barnum execution and then you restart, we have all of the information to restart from exactly where you left off.
[01:25:50] [2] Maybe this assess worthiness was in flight. Okay, we'll have to reinvoke that. But that's small and hopefully contained.
[01:25:59] [2] It's not like this, it's not necessarily a massive thing. And you can reinvoke, if you reinvoke it, hopefully it does the correct thing.
[01:26:07] [2] I don't have this in this version of Barnum. Earlier versions had this and then I did a refactor and then I didn't choose to bring it back quite yet.
[01:26:15] [2] But the idea is that you want this to be automatically serializable, automatically resumable.
[01:26:21] [2] And in that sense, yeah, okay, so that's one thing that I want that I think is going to be, that is pretty important to actually being able to use this for a larger variety of use cases.
[01:26:33] [3] One quick thing I would add there is that crashing, crashing, yeah, that's definitely a big use case.
[01:26:38] [3] But a bigger use case for this sort of, like, pause and resume is just human in the loop because sometimes a workflow, like, halfway in needs an approval from a user.
[01:26:47] [3] And if I'm away from my computer, I might not see that for, like, another day or so.
[01:26:53] [3] So if the next day I come back and I approve it, it should, I want it to start from right there.
[01:26:58] [2] Yes, that's a good point. And right now you would do that by just having a loop that sort of pulls, which is fine, but also maybe not the most ideal way to do this compared to just, like, short circuiting and sort of wa
[01:27:11] [2] iting for some input.
[01:27:15] [2] Yeah. And then the other thing is that all of these, I didn't actually mention this earlier, but the key thing about these handlers is that they're exported JavaScript functions and they each run in their own process, in
[01:27:26] [2] an isolated process.
[01:27:29] [2] Okay, that's nice because now they can't interact with each other. Sort of everything is sort of as enclosed as possible.
[01:27:38] [2] And so that specifically means for this case, like, well, we can just reinvoke that function if we happen to crash while assess worthiness is, oh Jesus, I have to figure out how to disable that garbage.
[01:27:53] [2] And in particular, well, the way we invoke those is from the Rust side, we invoke a process that calls node or calls pnpm or calls whatever
[01:28:04] [2] and executes that little, that JavaScript. And okay, that sounds, what's special about JavaScript?
[01:28:12] [2] Nothing. So we could also allow you to invoke Python, Bash, whatever custom
[01:28:22] [2] runtime for invoking Claude or something like that, sort of more directly as part of this.
[01:28:27] [2] Yes, exactly. Yeah. So in particular, it sounds super useful for doing stuff like orchestrating your Python, like your ML workflow in a way that is accessible to folks that are more used to
[01:28:41] [2] JavaScript. Or, I mean, there's also nothing special about this. Like, all we're doing here is some light transformation, generating an AST, and then serializing that and sending it to the Rust side where the real work h
[01:28:53] [2] appens. Like, this is actually super simple. Let's take a look. Do I have Barnum?
[01:29:03] [2] If I have, let's see, Barnum here.
[01:29:10] [2] Let's see. If we have this constant,
[01:29:16] [2] oh, that's not a JavaScript file. Those are Markdown. Okay, I think I can go to definition here.
[01:29:27] [2] Yeah, see, it's really simple. It's just.
[01:29:30] [1] Z dev?
[01:29:33] [2] I'm very new to Z, as you can tell.
[01:29:36] [2] So this, like, this constant function, which just happens to be one of the things you can do,
[01:29:42] [2] it just returns some AST thing. And then that gets generated into some sort of tree that gets composed and whatever and serialized and sent to the Rust side.
[01:29:52] [2] Nothing about this is specific to JavaScript. So we could just as easily have a DSL in Python, a DSL in whatever your language of choice is, in Ruby even, and it would work just as well.
[01:30:07] [3] Or a completely custom DSL.
[01:30:09] [2] Yep. Actually, I do want custom stuff. That's one of the things I do want ultimately, but you know, you got to be,
[01:30:19] [2] you got to be, you got to pick your battles, you know? So.
[01:30:23] [1] Use your technical innovation tokens or points. Someone had a term for that. You should only, like, bet on one big new piece of tech per project.
[01:30:33] [1] If you bet on too many, like, you use your innovation tokens. I think that's what they called it.
[01:30:39] [3] Yeah, I never follow that. I always, like, every time I have a new project, I pick, like, three to four new things that I want to play around with and I.
[01:30:47] [1] We got a question here. And then after that, I do want to go to the isograph stuff to keep us on track.
[01:30:51] [1] So I don't get why we need AST step, why do we need Rust. It could just be running inside TSS node.
[01:30:58] [1] And while you do that, I'm going to just use the bathroom real quick, so.
[01:31:02] [2] Yeah.
[01:31:04] [2] So the reason we want to use Rust is that Rust is, it makes it easy to actually write code that is more correct and more trustworthy.
[01:31:18] [2] And
[01:31:20] [2] there's sort of, like, two aspects to this. On the one hand, there is
[01:31:25] [2] this layer here where this is invoked sort of to construct the AST. And then these handlers are construct, are run in separate processes.
[01:31:36] [2] And then there's something in between. We could, in theory, just do this entirely in JavaScript.
[01:31:43] [2] But I think if we did this entirely in JavaScript without at least having an intervening layer that called a bunch of processes in their own, a bunch of, like, handlers in their own process, well, then everything could sort
[01:31:56] [2] of reach out and have whatever side effects you want, they want. And if you have whatever side effects you want, then you kind of struggle
[01:32:09] [2] to have the guarantees that everything is actually correct in the way that you want.
[01:32:15] [2] But that being said, obviously Rust and JavaScript and everything else, it's turn complete and you can sort of do whatever you want in whatever language.
[01:32:24] [2] So I think the most important part here is that there is,
[01:32:30] [2] one, it's, I like Rust. I think it's a great language. And two, the disconnect between the runtime and the invoked handlers and the isolation of the handlers is somewhat important.
[01:32:43] [2] At least in theory, that's important. Yeah.
[01:32:46] [3] Yeah. Yeah, I think that makes sense. I think the focus of the question was probably not on, like, why Rust, but more on, like, why does there need to be an intermediate step?
[01:32:58] [3] Like, why do you need a step that constructs the AST and another step that
[01:33:05] [3] interprets or executes that AST and then calls out to these external processes rather than the workflow itself being a Rust or a TypeScript function that gets executed dynamically.
[01:33:18] [3] And yeah, so you're saying that the isolation between the orchestration and the handling is important.
[01:33:25] [3] And I think one of the reasons why that's important is the pause and resume thing that you mentioned earlier.
[01:33:32] [3] Like, you cannot, you just cannot do that in vanilla TypeScript unless you introduce, like, I guess, more syntax of some sort or, like, use workflow, use step that Vercel has.
[01:33:45] [3] And then you add a custom compiler there, but you kind, yeah, maybe that's, like, one of the reasons, but yeah, that'
[01:33:55] [3] s.
[01:33:55] [2] Yeah, yeah, that's right. I think the isolation is not easy to, well, yeah, you need the isolation for exactly for the resumability and just for ease of reasoning.
[01:34:06] [2] And because,
[01:34:11] [2] yeah, I mean, that's basically for that. I mean, you also get some other benefits from the isolation.
[01:34:15] [2] Like, you can have higher order functions really easily. So, like, retry this thing three times.
[01:34:19] [2] That's a really easy thing to do and it sort of wraps whatever you want and it doesn't necessarily know anything about what's happening on the inside.
[01:34:28] [2] It's kind of nice. But yeah, I mean, the real answer is, like, I like Rust. I think that this is a, it's a pleasant way for me to ship a lot of code in a small amount of time.
[01:34:40] [2] With respect to Temporal, this is also really similar to Temporal. I think it has better,
[01:34:46] [2] some better properties than Temporal. For example,
[01:34:51] [2] I think composability in Temporal is not very good. I think it's really hard to do stuff like
[01:34:59] [2] have higher order functions, retry things, and have the actual behavior that I want.
[01:35:05] [2] So in particular, this loop thing here, this gives us a function recur. And whenever recur is encountered, well, it has a return type of never.
[01:35:14] [2] Whenever it's executed, well, then we tear down this AST and we re-execute this AST in this case.
[01:35:23] [2] And so we dequeue another file at that point in time. So recur also occurs here.
[01:35:29] [2] And so if I, for example, like, move this up, well, then, I mean, it still continues to work.
[01:35:33] [2] And I can pass recur to some sort of, like, wait five, you know, sleep then, right?
[01:35:41] [2] Recur. And that will just work. Like, recur is just a value that gets passed somewhere else
[01:35:47] [2] and so on and so forth. All these kind of things, like, I can do because I was
[01:35:53] [2] , I made a very specific deliberate choice. And I think that many of these other libraries, Temporal, they have more users because what they're doing is more approachable, but it limits the ceiling.
[01:36:05] [2] And I'm not necessarily building a business out of Barnum, so I'm okay with.
[01:36:11] [1] Yeah, Temporal also, like, a whole platform. Like, it's not just a library, right?
[01:36:14] [2] Yeah, yeah. And that's probably where the money's at. It's like doing the, doing
[01:36:20] [2] the replayable work. I don't even remember what the term is. Durable execution.
[01:36:26] [3] Durable.
[01:36:28] [2] Yeah.
[01:36:29] [1] I only know about this because Swix worked at this company for, like, a year. So I used to always listen to every interview Swix would ever do.
[01:36:35] [1] So I heard them talk about Temporal for, like, a whole year. And I'm like, this is solving a problem I do not have.
[01:36:41] [2] Yeah.
[01:36:47] [2] But yeah, so that's Barnum. I do hope folks try it.
[01:36:51] [1] This is very, very cool. I will definitely try it out because I got lots of refactors I always want to do.
[01:36:58] [1] Let's get into Isograph a little bit. I looked at the docs and I'm like, I see GraphQL queries and it's being fed into some sort of React-like component syntax.
[01:37:11] [1] And that's pretty much all I need. Like, I'm sold.
[01:37:14] [2] Nice.
[01:37:15] [1] There's nothing about this that would confuse me because this, to me, is just how all programs should be written forever.
[01:37:22] [2] Yeah.
[01:37:26] [2] So
[01:37:28] [2] Isograph, I guess, like, let's take a quick detour, talk about GraphQL. What is nice about GraphQL?
[01:37:37] [2] What's nice about GraphQL is that you have
[01:37:41] [2] a few things, is that you have fragment-like compose, you have composability. So you might have, like, a homepage or a user detail fragment.
[01:37:49] [2] And in there, you might spread the user avatar. And that means that whenever you, the user avatar fragment, and whenever you modify the fragment, for example, you might add the email or the image URL or the ID or whatever,
[01:38:02] [2] well, that gets sort of automatically added to the parent fragment, all of the parent fragments.
[01:38:09] [2] And ultimately, that bubbles up to a bunch of queries. So you essentially are able to define, and each of these fragments is associated with one component in your code base, ideally.
[01:38:20] [2] And that means that when you modify one component, you can modify its fragment to have exactly the fields that you need locally and no more and no less.
[01:38:31] [2] And that automatically bubbles up to whatever queries. And these queries will fetch exactly the data that happens to be needed by the current configuration of
[01:38:41] [2] your page. So you can reason locally and everything ends up being correct. Now, if you have something else, let's say TanStack and Rust, well, you kind of have some bad options.
[01:38:55] [2] So for example, you're modifying some sort of deeply nested component. If you add a field, okay, I mean, it's not so bad.
[01:39:02] [2] Now you go find whatever queries and add, like, the email field to those queries, right?
[01:39:08] [2] And maybe that's, like, selecting it from Rust. Maybe the backend now has to start returning email.
[01:39:12] [2] I don't know exactly what it is, but you make some change and you start getting email.
[01:39:15] [2] But now if you stop using that email field, well, that's tough because now you have to go to these queries, remove the email field.
[01:39:22] [2] Maybe you have to kind of do some research to determine is any other subcomponent in the tree using that email field.
[01:39:27] [2] And the answer is nobody does that amount of research.
[01:39:32] [2] And so queries get bloated. They get filled with fields that are not used. Okay, most people will look at that description and say, that sounds theoretical.
[01:39:42] [2] That sounds like a big company problem. I only pass data down a couple of layers.
[01:39:47] [2] And that's also a problem. You have, like, limited the amount of complexity that your app is able to absorb.
[01:39:54] [2] And you are prevented from breaking up your components into smaller and smaller parts, even if that's the correct thing for your particular use case, because you need to be able to reason about an entire tree in your head
[01:40:05] [2] at once. So once again, all non-relay, non-isograph frameworks make the wrong trade-off.
[01:40:12] [2] They sort of limit your complexity and make it so that if you try to do the right thing, you are overwhelmed.
[01:40:21] [1] Real quick, what would you say to someone who would say, that's all great, but I already know how to do Rust and the overhead I'm going to get from GraphQL is not worth solving that problem for me?
[01:40:33] [2] I think it depends on the situation. You, for example, might come back from a week-long vacation and you come back to your code base.
[01:40:42] [2] And in the meantime, dev has made so many changes to it. And now you don't know what it's like.
[01:40:47] [2] The reason that worked before was because you or some other code owner understood everything.
[01:40:52] [2] But now changes have been made and you don't.
[01:40:54] [1] You crash yourself, yeah.
[01:40:55] [2] Yes, yes, exactly. And the same thing could be said about Git. Okay, I'm the only person using, modifying this repository.
[01:41:04] [2] I don't need these fancy branches. Like, what's the point of that, you know? Like, but you still want to use Git for, and the reason is that even though you are not multiple people, you are multiple people, one person in
[01:41:17] [2] the morning and then you've forgotten what you're doing on the evening and then whatever.
[01:41:21] [2] And furthermore, the developer experience cost of using Git is so low that it's worth it even on single-person projects that have
[01:41:30] [2] a linear history. Same thing is true for GraphQL. You want to be able to reason locally when you modify components and not load
[01:41:42] [2] the entire code, all the code into your head. Okay, loading code into your head, that's using context.
[01:41:49] [2] Okay, context is expensive. If you are an LLM trying to make changes, the less you have to reason about the entirety of the code base, the cheaper and more reliable and better.
[01:42:00] [2] So there's a lot of reasons why you want to use GraphQL.
[01:42:04] [1] And LLMs are where they work better when they have a schema to go along with.
[01:42:09] [2] Yes.
[01:42:09] [1] And there's some sort of thing that can guarantee, you know, different types and how it can understand the whole architecture and how it all fits together.
[01:42:17] [1] So like, if you could point at an RFC or something or like a spec like GraphQL, then there's a whole set of things it already can figure out how to do within that world of that convention.
[01:42:29] [2] Yes.
[01:42:31] [2] Okay, so now we're going to jump a couple steps forward. Why Isograph? Okay, so with GraphQL, you have fragments and each fragment is associated with a specific function.
[01:42:43] [2] So you have, like, this user detail avatar and it reads the fields that are needed by the user detail component.
[01:42:50] [2] And that has to be a one-to-one connection because otherwise maybe you're overfetching or you're underfetching.
[01:42:55] [2] So you don't want to reuse fragments
[01:42:59] [2] despite what Apollo's docs will have led you to believe and so on. You don't want to reuse queries.
[01:43:05] [2] You want to just have exactly the one query per screen and it composes correctly based on all of the things that are in the thing, in the screen.
[01:43:14] [2] Okay, so
[01:43:17] [2] if the user detail component, I'm, by the way, just like on a random page here.
[01:43:22] [2] I wasn't actually thinking about whether this is the correct, maybe quick start guide has a simple example.
[01:43:28] [1] Yeah, you should just pull up, like, I mean, even better would be just like the GraphQL.com fragment, like a page just so people can get a sense for, because
[01:43:40] [1] if you don't know GraphQL, like, a fragment itself is a very specific kind of part of it because you have, you know, queries and mutations, but fragments is kind of how you can compose different GraphQL queries together,
[01:43:53] [1] right?
[01:43:54] [2] Yes, exactly.
[01:43:58] [2] So there we go. We'll do this. Repository link. Okay, so in particular, maybe you have a, this is actually in our, like, internal GitHub demo on Isograph.
[01:44:15] [2] If you have a component, a repository link component, this function right here that happens to read some sort of, essentially you can think of this as a fragment for now.
[01:44:24] [2] So there are some fields on repository, which is a type in your GraphQL schema.
[01:44:28] [2] You might read the name, ID, owner, login, whatever. Well, there's a one-to-one correspondence between the fragment and the component that uses that data.
[01:44:39] [1] Right, yeah, because you're pulling out these specific things with the GraphQL query.
[01:44:43] [1] Each of them is going usually to some sort of, like, HTML fragment to have it compose with a component.
[01:44:49] [1] That's why it fits so well together with something like React.
[01:44:52] [2] Yes, yes.
[01:44:56] [2] Now, with every framework except for Isograph and to some extent Houdini, which is another great framework, there, that component, the fact that
[01:45:09] [2] the fact that one function reads a particular fragment is not known at compile time.
[01:45:14] [2] And you can't take advantage of that. But on the other hand, with
[01:45:22] [2] Isograph, we know the fact that this repository link component reads this data.
[01:45:28] [2] This is exactly one thing
[01:45:31] [2] for the, for this, for our purposes. So in particular, if you search for repository link and I don't have
[01:45:40] [2] the
[01:45:42] [2] language server installed, I actually haven't, like, done anything with Isograph on this new computer yet.
[01:45:47] [2] You'll notice here that we have this parent. I don't know what this parent is, but it's some sort of GraphQL field.
[01:45:52] [2] And we select the repository link on it directly. Now, the GraphQL schema does not have this repository link
[01:46:00] [2] as part, as a field on it. But because we defined this repository link here, or here rather, we can now just directly select it.
[01:46:11] [2] So now conceptually, what are you doing? You're starting with the homepage. You're selecting the body.
[01:46:17] [2] The body might have a current blog post. The blog post has a blog header. And you're just selecting all these components through the field.
[01:46:22] [2] And you just received them. And they're already pre-bound to the data that they end up using.
[01:46:27] [2] So here, this repository link, what do we do with it? Again, forgive the syntax errors because
[01:46:34] [2] I haven't, I guess I haven't run, I need to run the, I need to run the compiler in here because it generates a bunch of files.
[01:46:41] [2] And
[01:46:42] [2] in this repository link,
[01:46:47] [2] in here, parent.repository link, that's a component that happens to know about all the fields that it selects.
[01:46:53] [2] And so here, what if we change repository
[01:46:58] [2] link to select some other fields? Well, nothing here changes. We're not passing any data down, but it happens to be, it happens to know that it's closed, that closes over those fields.
[01:47:09] [2] Okay, we do pass set route. That's not part of the graph data. That's just a regular prop that we define here.
[01:47:17] [2] And so that's nice. That means that you can essentially define your entire
[01:47:22] [2] app as like a set of nested components. And each of these components close over the data that they happen to use.
[01:47:28] [2] And this, just like with GraphQL, generates a query for all the fields that are needed by a given page.
[01:47:34] [2] So let's just say, let's just search for queried text. Oh, so on our Pokémon demo, like, this generates this query.
[01:47:42] [2] And this is sort of what is executed.
[01:47:44] [1] Pokémon concludes the form key number species in the sprite image.
[01:47:50] [2] Yeah.
[01:47:52] [2] And yeah, so this is like the query that is actually executed at compile time. And, oh, sorry, not at compile time, actually executed when you run the page.
[01:48:03] [2] And this will get all the data.
[01:48:05] [1] Throws a string over to the GraphQL endpoint.
[01:48:07] [2] Exactly. And then this at runtime will, well, basically we generate a bunch of files, which you don't need to look at, but there are just these JSON things.
[01:48:16] [2] Let me find a slightly better one. Yeah, cool. It's a bunch of JSON things. It's this AST.
[01:48:21] [2] And using this AST, what we're going to do is when we read this
[01:48:28] [2] pet updater, I know it's small, when you read this pet updater component, it will use this AST to read out the fields that it knows came back from the network response and render the components that we're talking about her
[01:48:45] [2] e. So, okay, so that's a lot of, like, technical description. It's not super,
[01:48:53] [2] let me actually talk about why this matters. Well, one, there's no way to mess this up.
[01:48:59] [2] You can make whatever changes you want to repository link and nothing has to change anywhere else.
[01:49:03] [2] You don't have to reason globally. So that means you or an intern or
[01:49:09] [2] Opus, I mean, I don't know, Haiku can reason about these. And like, you don't have to be that smart.
[01:49:16] [2] You can just make the changes
[01:49:20] [2] and everything just continues to work. There's just like so little boilerplate compared to any other framework.
[01:49:26] [2] Secondly, there's some advantages to this, to these two being
[01:49:32] [2] associated at build time. So for example, if you defer the JavaScript, sorry, if you defer the data for some subpart of your tree, like, let's say you have, you fetch the blog post and it takes a long time to fetch the com
[01:49:45] [2] ments section. So you defer that. GraphQL has a facility for essentially fetching that as essentially a follow-up network response.
[01:49:56] [2] In GraphQL and relay and every other framework, like, if you're going to defer some data like that, well, then you need to manually also probably asynchronously load the JavaScript for that components thing.
[01:50:10] [2] But because we know at build time that the component JavaScript and its data are both, well, there's one place where you can defer them both.
[01:50:18] [2] And thus, if you search for something like at loadable
[01:50:23] [2] ,
[01:50:25] [2] lazy load artifact true, if you do this, whoa, what just happened? I want to do this.
[01:50:34] [2] This is like a bunch of tests. But if you happen to do this, well, then
[01:50:42] [2] this is a broken test for, because it's showing some sort of broken state on purpose.
[01:50:48] [2] This image display wrapper here, this image display, the data for that image display component and the JavaScript will be asynchronously loaded when we render this component.
[01:50:59] [2] So that's like one of the benefits of being able to connect these. But there are more benefits.
[01:51:05] [2] There are lots of benefits. One of the other benefits is like, imagine your large company code base.
[01:51:12] [2] How many user avatar components do you have? Probably like 50 gajillion. And the reason for that is because it's like not really easily discoverable.
[01:51:19] [2] And so you have so many duplicate things. But on the other hand, here, if you are on a user and you start typing dot avatar or something, it'll just suggest, it'll suggest that for you if we have the, if we have the lang
[01:51:32] [2] uage server installed, which is not installed. So therefore, it will cut down on essentially
[01:51:39] [2] duplicate components. And instead, you will be softly pushed into having the one right user avatar component that actually works for, you know, sort of all the use cases.
[01:51:51] [2] Yeah, that's the spiel.
[01:51:52] [1] Thanks.
[01:51:54] [2] Cool.
[01:51:54] [1] Things like at loadable, those are directives, right?
[01:51:59] [2] It looks like a directive, but it's really an Isograph thing.
[01:52:02] [1] It's really an Isograph thing. Okay, yeah, that was the thing that is mainly makes it different from just pure GraphQL because you do, you're not just throwing pure, you're not just sticking to the spec, you're building
[01:52:14] [1] things into it. So they're kind of GraphQL-esque queries, but they're not exactly the same.
[01:52:20] [2] Yes.
[01:52:21] [3] Or at least it's like a, it's like a superset, like all the GraphQL behavior with some added syntax, kind of like TypeScript as with JavaScript.
[01:52:32] [2] Yes. So for example, this blog item here, like this image display wrapper, is it, it's a field that we're selecting on image.
[01:52:42] [2] But like, type image here, it doesn't have that field. So we're like, we're augmenting the schema with a bunch of other stuff.
[01:52:50] [1] Right, yeah.
[01:52:52] [2] Yeah.
[01:52:52] [3] And the things you add to the schema, that it's not just data, it's UI essentially.
[01:52:57] [3] So when you fetch, when you write or when you execute a GraphQL query and you select those fields, you don't just get JSON, you get a React component that you can just return from your, from the React component that fet
[01:53:11] [3] ched that data. And you'll just, you'll have the UI for it.
[01:53:15] [2] Yes.
[01:53:16] [3] Which is pretty cool.
[01:53:17] [2] Yeah. So this might get a little bit in the weeds. Okay, but one of the things that you might notice about Graph, one of the things about GraphQL is that in theory, you should not be removing fields from the schema.
[01:53:29] [2] You should only be doing forward, you should not be doing backwards incompatible changes, of which removing a field is one.
[01:53:35] [2] Now, you also have an issue where, let's say you have a user
[01:53:42] [2] and then you have this user's favorite restaurants, right? Okay, so the way you would
[01:53:48] [2] define that is a field called favorite restaurants on the user. Okay, right? Oh, well, what if we have like user's favorite restaurants in a given city?
[01:53:57] [2] Okay, so now we have user and then we have city and then we have favorite restaurants on that, like, weird combination of, like, stuff, right?
[01:54:09] [2] But like, okay, so maybe this is hometown, right? User hometown favorite restaurants, right?
[01:54:14] [2] And like, if you look at that, why are we doing this? Well, the answer is that if we were to fetch the user and fetch their hometown and then fetch the restaurants, that would be a network waterfall.
[01:54:27] [2] And GraphQL's raison d'être is to avoid network waterfalls. So you end up structuring this as part of the GraphQL schema.
[01:54:35] [2] So you have the user and then their hometown and then favorite restaurants in hometown on user.
[01:54:40] [2] Okay, right, but like, that's also really awkward because, well, now it's not really favorite restaurants on a hometown, on a town.
[01:54:48] [2] It's just, it's the user's, it's some tuple of the user plus the hometown and then favorite restaurants on that.
[01:54:55] [1] You take on a lot of complexity into the schema for the sake of the simplicity of the query.
[01:55:00] [2] Yes. And for the performance of it. Now, what exact, why do we want that? And the reason is that some particular version of some particular product wanted to show you the favorite restaurants in your hometown because it
[01:55:15] [2] 's hometown celebration month on yelp.com, you know? And okay, only web does that because web iterates faster than iOS and Android or something like that.
[01:55:24] [2] Who cares?
[01:55:26] [2] But this extra cruft gets added to your schema and it's, one, visible to Android and iOS.
[01:55:33] [2] Two, it's useless on their thing. And three, it is specifically serving the specific needs of a specific UI.
[01:55:40] [2] Okay, how do we add fields in a particular
[01:55:45] [2] repository such that it is only accessible in a particular piece of UI? Well, that's exactly what this is.
[01:55:50] [2] This repository link does not get added to the schema in the abstract. It gets, it's visible as part of this Isograph project.
[01:56:00] [2] And if this Isograph project no longer wants to use the repository link, well, then it kind of disappears.
[01:56:06] [2] Next version doesn't have it. Okay, now
[01:56:10] [2] this executes on the client. Okay, repository link, it's a component. Maybe it's not the best example, but I think we have something like formatted date.
[01:56:18] [2] Okay, just imagine we have a formatted date. It somewhere exists. I just don't know what it's called.
[01:56:23] [1] It takes a JavaScript date, turns into, you know, YYYYY-.
[01:56:28] [2] Exactly. Yeah.
[01:56:30] [1] Yeah, yeah, yeah.
[01:56:30] [2] Year, month, date. It's nice to define that
[01:56:35] [2] in as if it was a client field, just like these. But it would also be nice to execute that on the server.
[01:56:42] [2] And so the next thing that Isograph will be doing, I mean, in theory, I mean, there's too many things for me to do with my limited time.
[01:56:50] [2] But one of the things I want to do with Isograph is to allow you to move the execution of this thing onto the server.
[01:56:58] [2] So now you can do exactly what we just discussed, the favorite restaurants in your hometown.
[01:57:03] [2] You can define that in localized to a specific project. It can execute on the server for performance and your Android iOS teams are none the wiser.
[01:57:15] [2] And then when you modify things, well, whatever, it changes. The next version has a different version of hometown favorites, you know?
[01:57:25] [2] Yeah, so that's the idea. And the net effect of all of this
[01:57:31] [2] is that your app is a tree of
[01:57:37] [2] , it's like, it's like this dag of stuff that needs to happen. And Isograph is, I think, a pretty good way of expressing this sort of dag-like, tree-like workflow.
[01:57:49] [2] And
[01:57:51] [2] if you have this tree, you sort of can look at it in multiple different ways. One way is like some work gets hoisted to the server.
[01:58:00] [2] Okay, that's kind of like React server components. It's just basically what I described, except React server components is a bunch of limitations that this gets to avoid.
[01:58:08] [2] It has another benefit, which is that it's, there's a big company behind it. So, you know, there's trade-offs.
[01:58:13] [2] But in theory, this is a bet
[01:58:18] [2] ter, a better model.
[01:58:19] [1] You can also do things like give API keys or stuff. Like you can do queries that can do other stuff if you're running it on the server.
[01:58:27] [1] Because this was the thing that when I worked at my GraphQL company steps then, it was a hosted GraphQL endpoint, but it would be locked down from the top.
[01:58:35] [1] So you'd have to run your GraphQL queries in like a serverless function. And so that would kind of push you to doing it on the server.
[01:58:44] [1] But then you would think a lot about your actual query and then get the data you need.
[01:58:48] [1] And like you say, then you get exactly what you want for each page.
[01:58:52] [2] Yes. Yeah, that's exactly right. Like you have, like you can, there's a lot of stuff you can execute on the server.
[01:58:57] [2] Maybe secrets. Maybe you want stuff moved up there for performance. Maybe you have, and also maybe the backend thing is written in a different language.
[01:59:06] [2] In this case, okay, so what are we doing here when we reference this image display?
[01:59:12] [2] We're saying from the perspective of this image display wrapper, we, well, okay, this is loadable.
[01:59:18] [2] So like, let's just talk about a simpler example. This image display wrapper here, we don't know anything about it.
[01:59:24] [2] All we know is that there's some function that has some return value. Well, whatever, we have a return value.
[01:59:30] [2] Happens to be a component, but like, let's just say it's a string. Okay? We don't care how that string was calculated.
[01:59:35] [2] We don't care where it was calculated. And so that, and all we're doing is we're saying we want this particular string.
[01:59:42] [2] What if that function, what if that image display wrapper was written in Python?
[01:59:46] [2] Well, it has to execute on the server. The server is the only one that knows how to execute Python.
[01:59:50] [2] But we could now intersperse,
[01:59:55] [2] again, because of that isolation that we talked about earlier,
[02:00:00] [2] a lot of
[02:00:03] [2] , a lot of work in sort of a tree-like thing. And yeah, anyway, so I'm going to leave it there that there's a lot in common between both of the projects.
[02:00:15] [1] Yeah, no, that's right.
[02:00:16] [3] Definitely.
[02:00:17] [1] And this is being used at Pinterest right now, you were saying?
[02:00:21] [2] No, no. There's a, there's a startup that's using Isograph. Barnum, I'm using Barnum very extensively at Pinterest to ship a very large number of PRs.
[02:00:33] [2] And I've, some other folks at Pinterest and elsewhere have used Barnum. But like, I haven't really focused yet
[02:00:44] [2] on the marketing. I haven't really strongly focused on marketing it yet. So.
[02:00:49] [1] All right.
[02:00:49] [2] Who's using Isograph? This company that is called.
[02:00:54] [1] Also, one of you two, right now there's a like radio bleeding through or something.
[02:00:59] [2] You better go ahead and guess that that's not me.
[02:01:01] [1] Yeah, that's bad.
[02:01:02] [2] Yeah.
[02:01:05] [2] Bolt Foundry, there we go. This company is.
[02:01:09] [1] I've heard of Bolt Foundry.
[02:01:10] [2] What? You know them? That's so cool. Yeah.
[02:01:12] [1] They, they didn't, okay, hold on. Bolt Foundry hosted GraphQL Texas, didn't they?
[02:01:19] [2] Not sure. I, they're based in New York and Utah as far as I know.
[02:01:24] [1] Okay, there is.
[02:01:27] [2] Maybe, for all I know, yeah.
[02:01:29] [1] They, they hosted, they hosted a GraphQL meetup that I, I did. It may not have been New York because I did a bunch, but that is why I've, I've heard of Bolt Foundry.
[02:01:39] [1] So yeah.
[02:01:40] [2] Yeah. Yeah, they're very happy users of Isograph and.
[02:01:46] [1] Still.
[02:01:47] [2] Yeah.
[02:01:50] [3] There are so many interesting things about GraphQL that I would, or sorry, not GraphQL, GraphQL as well, but Isograph specifically that I feel like I want, I could talk about forever.
[02:02:04] [3] I think the way that.
[02:02:05] [1] If you want to come back for another episode, Robert, that we could do all on Isograph, that would be great.
[02:02:10] [1] We still have more time, but just saying, throw that invitation out there.
[02:02:14] [2] Oh yeah, we'd definitely be happy to. Yeah.
[02:02:16] [1] Yeah. Go ahead, Dev.
[02:02:18] [3] Yeah, I mean, in, in, in specific, I think the way that, the way that you decide to compose queries and components together that, that, that feels very nice that they're kind of eliminate so much of boilerplate.
[02:02:33] [3] Like it's not a framework that comes with a bunch of hooks that you need to learn how to use or like custom components, anything like that.
[02:02:42] [3] Am I still, okay, yeah.
[02:02:44] [2] Yeah, you're still here.
[02:02:45] [3] Ye
[02:02:48] [3] ah, and so, okay, one, one thing that I was wondering is, is there, you mentioned that there is a build step
[02:02:57] [3] that kind of like goes through your routes and compiles together like one giant query that can fetch all the data for that page.
[02:03:07] [3] I'm guessing that compiler like literally goes through your React components to look at, like does it have to look through your React code to see what components you're rendering or just this query?
[02:03:19] [2] No, it, it's pretty dumb in the sense that it looks for Isograph literals.
[02:03:27] [2] And
[02:03:30] [2] these Isograph literals
[02:03:34] [2] are matched with a regex. So it looks for literally exactly this and then attempts to process them.
[02:03:40] [2] And then it also makes sure that they are, that they, well, it checks like a very few, small amount of other things.
[02:03:46] [2] And so it's basically looking for this pattern here. But it doesn't know anything about JavaScript.
[02:03:53] [2] And then there are lint rules. So these lint rules will enforce that this is, well,
[02:04:02] [2] are there lint rules? No, there are no lint rules. I, no, they're not, but there should be.
[02:04:06] [2] Anyway, we also enforce that this is exported and so on and so forth. So there's like very, there, there are limited things that we do enforce to ensure that this is done correctly.
[02:04:15] [2] But in terms of understanding JavaScript, not at all.
[02:04:20] [3] Got it. Okay.
[02:04:21] [2] Yeah, you could, for example, fool this by doing something like like this.
[02:04:28] [2] I mean, that actually is not a multiline. Okay, whatever. JavaScript doesn't have multiline things, but like, you know, whatever.
[02:04:37] [3] Yeah, so it sounds like something that could, like that might not need a build step or am I off here?
[02:04:44] [2] Oh no, it needs a build step.
[02:04:48] [2] It will, I think I will not be able to find this because it's, yeah, it's not in whatever Zed marketplace there is, does not include the extension.
[02:04:57] [2] TIL, we should publish it a bunch of other places.
[02:04:59] [1] Not surprising to me.
[02:05:01] [2] Yeah.
[02:05:01] [1] That's one of the big limitations of Zed.
[02:05:03] [2] Yeah. This is converted into a bunch of files. So in particular, that resolver reader that we talked about.
[02:05:11] [2] So it's going to have this author and title and content fields and so on. And this blog item more details on there as well.
[02:05:20] [2] It will also generate
[02:05:24] [2] a, this param type here. So basically when you add and remove fields from this, this gets modified.
[02:05:31] [2] And so now if you hover on this, this blog item thing here, you know that you have these types here.
[02:05:38] [2] And that can't be inferred from the JavaScript. I mean, from the, that can't be inferred by TypeScript.
[02:05:44] [2] Like I'm not going to try to go down that route. I don't think it's a good route.
[02:05:48] [3] Right.
[02:05:49] [2] It's technically impressive to do that, but like,
[02:05:53] [2] no.
[02:05:53] [3] Like, like building Doom in TypeScript only at.
[02:05:57] [2] Exactly. Yeah.
[02:06:00] [2] And what's also interesting about this is that like, I mean, this isn't, it isn't a, anything that a backend knows how to execute, but we still have this query text here.
[02:06:11] [2] This other query text that, yeah, like this one, right?
[02:06:15] [3] Right.
[02:06:15] [2] Okay, this is a pretty boring ass query. But like this thing is generated also.
[02:06:21] [3] Right.
[02:06:21] [2] And
[02:06:23] [2] one thing that's nice about this is that, so one of the benefits of GraphQL is that you have fragment-like composition.
[02:06:29] [2] But there's no fragments to be found anywhere in these query texts. We have done the inlining ourselves.
[02:06:35] [2] And so that means that we are essentially doing fragment-like composition in user land.
[02:06:41] [2] So we can, instead of generating GraphQL here, we could generate SQL. We could generate TRPC.
[02:06:46] [2] We could generate your custom backend code that says like, hey, data, db.get node, dot get type name, dot get ID, whatever, like, and then return, package that up and generate it for you.
[02:06:58] [2] And Isograph is written in a way that is generic in the sense that there is an interface that we implement that knows how to generate GraphQL.
[02:07:08] [2] And there would be just as, we just have to have another interface that implement, that we implement that would generate SQL or would generate whatever custom backend stuff that you want.
[02:07:18] [2] And then again, we're not sending this, well, there are two ways to do this. One is you can send this string to the backend, which is sort of the easy no build process kind of way.
[02:07:29] [2] But the other one is that you would send, you would register this at build time, get an ID back, and then you would send that ID at runtime.
[02:07:39] [2] And that ID will,
[02:07:44] [2] will, the, the backend will look up that ID in a database or something, execute this and send that value back to the backend.
[02:07:51] [1] It allows you to create like a level of interaction between the actual GraphQL query and how the frontend accesses it.
[02:07:56] [2] Exactly. And it adds security because like if you accept any arbitrary GraphQL, well, then you could have something that sort of DDoSes your backend.
[02:08:06] [1] Right, yeah.
[02:08:07] [2] Or exposes information that you don't want to expose to users, but it's part of your GraphQL schema and oops, nobody noticed.
[02:08:15] [2] So.
[02:08:16] [3] Nice. Yeah, I'd be curious to see this. I'd be curious to see this work with some sort of a, a sync engine maybe where the same query can run both on the server and on the client.
[02:08:30] [3] And when you, when you receive any data from the server, you also store it on the client side.
[02:08:35] [3] So you can do like instant,
[02:08:39] [3] I don't know, instant navigation. I guess a relay kind of does some of that. Like there is a normalized cache.
[02:08:45] [3] What's, what, what is like the caching and optimistic story if you have one in Isograph?
[02:08:53] [2] Yeah, so while I figure out how to install PNPM and so on,
[02:09:02] [2] I thought I installed PNPM already. I guess I haven't. I mean, this is a really new laptop.
[02:09:07] [2] So in Isograph, you have essentially,
[02:09:12] [2] did it work
[02:09:14] [2] ? Command not found, PNPM, why? It's probably not in the, it's probably there, but it's not in the.
[02:09:20] [3] You might need to restart the terminal or something.
[02:09:23] [2] Yeah, let me try that. That's a good idea. Nope, still not there. It's not in the path.
[02:09:27] [2] Yeah, okay.
[02:09:30] [2] Weird.
[02:09:31] [1] NPX, PNPM.
[02:09:33] [2] That's what I needed to do.
[02:09:36] [2] Okay, so
[02:09:39] [2] Isograph has a normalized store. So everything that we get from the backend gets keyed by, that's keyed by ID, gets put into a normalized store.
[02:09:48] [2] And then when we actually read the data, we read the data from that store. So there's sort of two separate processes.
[02:09:54] [2] The network responses right into the store, completely coincidentally, reading, reads from that same store.
[02:10:01] [2] And there is a, we, we hope that the responses give all the data that we need for the frontend and it happens to work out in that way.
[02:10:10] [2] But that's not like structurally guaranteed. And this means that we can do a lot of really cool things.
[02:10:18] [2] So for example, in Isograph, like in relay, if you try to read a component and some data is missing, it will suspend.
[02:10:26] [2] And so that means that if you navigate from a list view to a detail view, well, maybe you have enough information.
[02:10:33] [2] Call it fine.
[02:10:35] [2] Oh, god damn it.
[02:10:39] [2] Maybe you have enough information. You know, it's not that Isograph is hard to run.
[02:10:43] [2] It's that I don't know how to install PNPM.
[02:10:48] [3] Hey, if, if Claude can't, if Claude cannot also figure it out, then it's probably you're fine.
[02:10:54] [2] Yeah.
[02:10:57] [2] Yeah.
[02:10:59] [2] I, I think I just need to add this to my CRC. So, okay, so if you navigate from a list view to a detail view, the outer component, let's say the one that shows the title of the detail view will already have enough data ins
[02:11:14] [2] ide the store. And so it can immediately render. And if you wrap the rest of the content in a, in a suspense boundary,
[02:11:22] [2] I give up.
[02:11:25] [2] And
[02:11:27] [2] then you will immediately render the upper part and then the, the bottom part will suspend and you'll show a spinner there.
[02:11:33] [2] And then eventually it will pop in. So yeah, so there's actually a really good story here, but it actually goes beyond just the naive thing, which is what I described is also in relay essentially and possibly in other fram
[02:11:44] [2] eworks as well. But one of the things that you know about Isograph is that you have this dag of work that is being done.
[02:11:53] [2] And one of the things that we are sort of doing in, but not fully, and the, the way it will work is that ultimately you will have everything in
[02:12:05] [2] , all the pre-computed stuff is stored in the relay store. So for example, the formatted date, that is some sort of function that depends on the actual raw date.
[02:12:16] [2] And then you have something like the, the current day display clock, right? That depends on the formatted date.
[02:12:23] [2] Okay, so when the, when the underlying date changes, well, then we recalculate the formatted date.
[02:12:28] [2] Okay, but maybe the, the, the formatted date doesn't show the year and only the year changed or whatever.
[02:12:34] [2] It doesn't show the seconds and it only shows minutes, right? So now we can short circuit and we don't have to re-render the,
[02:12:42] [2] the clock, right? Okay, maybe the, the clock shows seconds, but whatever. The milliseconds changed and the seconds didn't change.
[02:12:49] [2] So we can short circuit and re-render the clock and not re-render the clock. And the whole thing will be like this tree of work that we have calculated and we will try to calculate the minimal amount of work that needs to
[02:13:01] [2] be done in response to changes to the underlying data.
[02:13:07] [2] And
[02:13:09] [2] that is kind of a universal problem. A lot of what you want to do is the minimum amount of work.
[02:13:16] [2] The way you make apps be performant is you do less work. It's not that you get better at doing the existing work.
[02:13:21] [2] It's that you figure out you're smarter about doing less work. So you have to keep track of what goes into, what flows into what.
[02:13:28] [2] And that's how with Isograph, like when you make a change to something or other, you'll only see the components that actually need to re-render actually re-render.
[02:13:38] [3] It sounds, to me, it sounds like the perfect framework to pair with Isograph is not React, but Solid.
[02:13:46] [2] I.
[02:13:46] [1] Of course you would say that, Dev. Solid JS. Team member, undisclosed affiliations.
[02:13:54] [2] Yeah. I, I, I don't think you're wrong. I think that the, what's nice about Solid, there's a lot of nice things about Solid.
[02:14:03] [2] And
[02:14:05] [2] one of them is the fact that it's like a little bit more stateful. Like the, the components actually have construction, are constructed once.
[02:14:11] [2] And that corresponds really well to what Isograph is doing. In React, like you have this idea that the,
[02:14:21] [2] the component can render any number of times before it mounts. And that's kind of like a constructor, but it's also really a problem.
[02:14:27] [2] But on the other hand, with Isograph, we know, because we know that there's a query route and this query route can reach the blog detail component, that this blog detail component needs to be constructed.
[02:14:41] [2] And it can be changed and modified and handled by the framework. So that's the idea there is that we have more hooks than, than React sort of allows you to do.
[02:14:52] [2] It's sort of like the class version of React would have been a better fit for, for Isograph.
[02:14:57] [2] I mean, it works just fine because the rendering part is relatively small. But like,
[02:15:06] [2] it did it. Okay, let's see. Let's, let's see. Wow, that's so fast. How did it, did it like, oh, probably because I already had the things in there.
[02:15:15] [2] Okay, so let me just take a look at the thingy. I think.
[02:15:19] [3] Yeah, it might have run PNPM install earlier, which means you have everything cached.
[02:15:25] [2] Yeah, it probably did. It right? Because, okay, so we want to do PNPM dev pet demo named after our favorite host.
[02:15:35] [2] And this will build a bunch of stuff in Rust. Did you catch all that? So
[02:15:43] [2] anyway, so then
[02:15:47] [2] we're mostly building the, the Babel, not the Babel plugin, the SWC plugin. And what are we, what are we complaining about here?
[02:15:57] [2] Cannot find, oh, I need to add the target.
[02:16:01] [1] Plasm.
[02:16:05] [2] Let me just
[02:16:08] [2] , that didn't even copy it. Okay, so I just need to
[02:16:13] [2] add Wasm 32 WASIP one target.
[02:16:20] [2] See what? The thing is we don't even need that because we only need that when we're changing it.
[02:16:24] [2] We don't actually need it to run the thing. I could be a little bit better about not requiring that.
[02:16:34] [2] Yeah, so eventually this will, will get there.
[02:16:39] [2] So
[02:16:41] [2] that's the thing. If you work on a project, you don't know all the steps that are actually required to bootstrap it.
[02:16:50] [1] It's just running, it's been running on your machine for so long.
[02:16:53] [2] Exactly. And at some point in time, I installed that. Okay, cool. So it should be doing that and it should work pretty well, pretty quickly.
[02:17:00] [2] Cool. Target installed. I believe it. Okay.
[02:17:05] [2] And
[02:17:08] [2] yeah, and then we can actually like show off some of the
[02:17:13] [2] .
[02:17:15] [3] Yeah, but I, I, I, I understand the point that it's Isograph does a lot of work in
[02:17:24] [3] that, that goes into making React app performant
[02:17:29] [3] to kind of like reduce re-renders and to, because basically if, if you have a component and you know exactly what that component depends on, that what data that component depends on, and you have that in a normalized stor
[02:17:43] [3] e, when that updates, you can go and re-render exactly those components
[02:17:49] [3] instead of like you don't have a, a top down tree, a, a top down like tree re-render where one component re-renders and all the children re-render.
[02:17:59] [3] And then the only way to put a break on that is like memoization.
[02:18:03] [2] Yes.
[02:18:03] [3] This is like an almost like an additional layer of memoization.
[02:18:09] [2] Yeah, it's actually, it's smarter about the memoization too because
[02:18:16] [2] what, that didn't even, that was not even correct. Because it has more information than, than is known at runtime, right?
[02:18:23] [2] It has the ability to look at a bunch of stuff and throw stuff away
[02:18:29] [2] and do the right thing despite not needing that. Like one of the, it's very similar.
[02:18:34] [2] I don't know if you all have seen Fate. Fate is something that Christophe Shadow, not Shadow, Christophe Nakazawa
[02:18:44] [2] has released. And
[02:18:47] [2] it is similar to relay. It's similar to Isograph, but it does that sort of at runtime.
[02:18:52] [2] So you actually have a data structure that does all this stuff. And that allows you to do, that allows you to do a few more things.
[02:19:01] [2] For example,
[02:19:06] [2] dynamically construct queries for just the fields that are missing. But on the other hand, it prevents you from doing more stuff at build time, which is, I think, the trade-off that relay and Isograph try to make.
[02:19:22] [2] Yeah, so let's see. I have no idea why these, these build things are, are failing.
[02:19:27] [2] Oh, yeah, it's because there's a newer version of, I'm on a newer version of Rust.
[02:19:32] [3] Oh, SWC.
[02:19:33] [2] Yeah, yeah.
[02:19:34] [3] Rust, okay.
[02:19:35] [2] Rust, yeah.
[02:19:39] [2] So as you can tell, new versions of Rust are, are released. And I have to, I have to do, I have to make changes as a result.
[02:19:51] [2] Yeah, and so
[02:19:54] [2] what's nice about this is that like you have some bad trade-offs in React. You, for example, need to specifically
[02:20:05] [2] break your components up into subparts in order to
[02:20:11] [2] theoretically get some of the performance benefit. Okay, same thing is true in, in Isograph.
[02:20:18] [2] Like it may, if you want to have that memoization layer between the formatted date and the clock, well, then you need to have a separate formatted date thing and the clock can't read the, the date directly.
[02:20:30] [2] One of the things I want to do with Isograph is essentially have a way to
[02:20:36] [2] encode more functionality into the query itself so that at build time we know that the formatted, the formatting occurs and it flows into the clock.
[02:20:47] [2] And you don't need to do anything. You don't need to say like I specific, I mean, you can just kind of do it in the natural way.
[02:21:00] [3] Are you kind of talking about like.
[02:21:03] [2] Yeah, but so you would dynamically.
[02:21:06] [3] Breaking apart, like breaking apart.
[02:21:06] [2] Yeah, exactly.
[02:21:07] [3] Components at build time?
[02:21:08] [2] Yes, exactly. Because you're able to encode more of the logic inside of the Isograph literal.
[02:21:14] [2] And you want it to focus on sort of not everything. So you probably want it to focus on like control flow and filtering and things like that because otherwise you go down the path of reinventing a version of JavaScript that
[02:21:27] [2] has
[02:21:30] [2] different semantics, but is like equally complicated and it's going to be very hard to integrate with other stuff.
[02:21:37] [2] But yeah, that's the, that's, that's one of the ideas that I have about that as well.
[02:21:42] [2] But yeah, but in general, you can do, you can be much more aggressive about caching with, with Isograph because you know all the, because the natural thing to do is to have these intermediate,
[02:21:56] [2] these intermediate things
[02:21:59] [2] like, like formatted date and stuff like that. And then they become these sort of memoization boundaries.
[02:22:05] [2] All right, it says it worked. Let's see if it works.
[02:22:08] [1] And I can go for another like 10 or 20 minutes because I am actually have to start wrapping up soon.
[02:22:12] [1] So my, my workshop starts in a half hour.
[02:22:15] [2] Oh, excellent. Okay, I won't keep you long. Let me show, let's just do one final demo.
[02:22:20] [1] And, and Dev, you should also, if you have any kind of final wrap-up questions for me, I would just, the only thing would be share like your socials and where people can get in touch and, and learn more.
[02:22:36] [3] Can't find Isograph React.
[02:22:39] [2] Yeah, I probably just need it to run PNPM install. Why is it not finding it? It should be finding it.
[02:22:45] [2] I thought it would run this by, oh, I, I probably need to run build, build, there's like anoth
[02:22:52] [2] er, one of these other ones needs to be run. Actually, let's just
[02:22:57] [2] , I don't remember where exactly it is. Is it here? No, it's here.
[02:23:08] [2] PNPM.
[02:23:09] [1] Like a monorepo structure you're in?
[02:23:11] [2] Yes.
[02:23:15] [2] I need to build the JavaScript. Watch libs. That'll, that'll do it. Yeah.
[02:23:23] [2] Okay.
[02:23:23] [3] Right. So this is the monorepo with Isograph itself and some demo applications, right?
[02:23:31] [2] Yeah.
[02:23:34] [3] Yeah, now it should be able to find, because I'm guessing Isograph React points to a version of the local package.
[02:23:41] [1] Yeah.
[02:23:41] [3] Nice.
[02:23:42] [1] Got your query, got your cards.
[02:23:45] [2] Yes.
[02:23:46] [1] A bunch of pets. Classic GraphQL demo.
[02:23:49] [2] Exactly. Okay, so let's go ahead and add some delay here. Let's just say.
[02:23:56] [1] This shit makes me so nostalgic. You guys have no idea. I haven't done GraphQL in like three years.
[02:24:02] [2] Nice, nice. Okay, so let's go ahead and give it a thousand milliseconds of delay.
[02:24:08] [2] Okay, and then close this out. And two, oh, I called it two seconds of delay. So now we have loaded the, like Michaela's name and image.
[02:24:21] [2] And so when we navigate here, you're going to have a two-second delay. Well, one, it has to get the JavaScript and then it's going to show the top.
[02:24:27] [2] And then, oh, that's interesting. Oh, let's try that again. Not sure why that happened.
[02:24:32] [1] Yeah, when you load her.
[02:24:33] [2] Yeah. So you notice that it showed the top first immediately and then the bottom, even though the server's running locally.
[02:24:40] [2] This takes exactly zero seconds in practice. But now if we press back, well, it goes instantly.
[02:24:45] [2] The images redownload because I guess it's Next.js and as images are not really, they're not, they're not Isograph's problem.
[02:24:53] [2] And if you go back to this demo again, now it's going to, everything's going to load immediately, even though, even if we were to make another network request in the background.
[02:25:04] [2] So now if we go here.
[02:25:06] [3] It's like failed to validate.
[02:25:08] [2] Yes. Well,
[02:25:12] [2] it, it, you can, you can opt into that. Yes, you could do that if you wanted to.
[02:25:14] [3] Okay.
[02:25:15] [2] But it's sort of up to you, whatever you want. So here, if we go to, oh, I don't even have the, wow, I don't even have the React DevTools.
[02:25:23] [2] That's how new this computer is.
[02:25:27] [2] Oh, item is inactive. Enable now. Re-enable.
[02:25:33] [2] So here, if we have the
[02:25:36] [2] , do we have the React DevTool? How do I enable them? Where do they go?
[02:25:42] [2] No, I don't know how to do the React DevTools.
[02:25:46] [1] I've been using DevTools in a while.
[02:25:48] [2] Yeah, they're enabled.
[02:25:49] [1] Like dev, I went over to the dark side. Solid.
[02:25:52] [2] Yeah.
[02:25:56] [2] Okay, well, in theory.
[02:25:57] [3] It might be an application, I think. I think that it, it's now moved into some other tab.
[02:26:01] [3] I don't know which one.
[02:26:04] [2] Ah, okay. Application?
[02:26:07] [3] Or not. No, okay.
[02:26:08] [2] I thought it was.
[02:26:09] [3] I was remembering something else.
[02:26:11] [2] Yeah.
[02:26:13] [2] Anyway, whatever. If we were to show that, then if you were, for example, to change the best friend here, none of this stuff would re-render.
[02:26:22] [2] None of this, all this other stuff down here, it would just show the new one here.
[02:26:26] [2] And here, if you touch this, it will just re-render this exact specific component.
[02:26:30] [2] Despite all of these components reading from the same, from the same object, essentially.
[02:26:37] [2] And
[02:26:39] [2] theoretically, I mean, if you were to do this as a React component, you would thread data down from the root and pass it to every child.
[02:26:46] [2] And so that pet has changed because now its check-ins have changed and it's, you know, its best friend has changed.
[02:26:54] [2] So you would pass that data down
[02:26:57] [2] and everything should recalculate and re-render. And that's incredibly costly, especially if you have, if you're paginating and you have like hundreds of items.
[02:27:08] [2] Like the first couple pages might be performant and it gets slower and slower and slower.
[02:27:12] [2] And with something like Isograph, you just re-render the components that actually have changed.
[02:27:17] [2] So it ends up staying snappy.
[02:27:21] [3] Nice.
[02:27:22] [2] Yeah. I think that that's, that's a good place to end it.
[02:27:27] [1] Yeah, no, very cool, man. Thank you for coming on and sharing both these projects.
[02:27:32] [1] Very, very interesting and it's great that they're open source and that, you know, anyone can, can try these out.
[02:27:38] [1] So, so we're always all about here. Yeah, why don't you just share.
[02:27:43] [3] Except that they're both in Rust, which means you need a PhD before contributing.
[02:27:50] [1] Not with the agents, buddy. Right where it hurts your ass too.
[02:27:56] [2] Yeah. So worth learning Rust. I think it's a great language. I would encourage y'all to learn it.
[02:28:03] [1] All right, so you're at x.com/statistics for the win.
[02:28:09] [2] Yes, exactly. Let me show that.
[02:28:14] [2] Can I jump to my profile? Yeah, here we go.
[02:28:17] [1] Yeah, and then I think I've got links to Isograph and all that stuff. I'll have in the description of the YouTube video.
[02:28:27] [3] And what, what do you say is the easiest way for someone to use Barnum? Let's say, let's say I used Codex right now and I'm kind of tired of
[02:28:38] [3] long sessions or short sessions and I want to adopt Barnum to re-into do refactor work, to do automations, background, whatever.
[02:28:47] [3] What would be the, do I just go to Codex and say that start using Barnum on this project?
[02:28:53] [2] Yeah.
[02:28:53] [3] Or is there like a skill.md file that teaches agents how to write Barnum?
[02:28:58] [2] If you point Barnum, if you point them to this best practices doc,
[02:29:05] [2] it does a pretty good job. I mean, this is, this is basically every single issue that I've ever encountered when asking it to do stuff.
[02:29:13] [2] So I just have it look to look at the best practices and read the docs. And it tends to be after that pretty good.
[02:29:23] [2] The, this, it tends to be pretty good at that point in time at writing Barnum workflows.
[02:29:27] [1] Can you add .md to your URL and just get a Markdown page?
[02:29:31] [2] I should, I should do that.
[02:29:35] [2] The answer is no.
[02:29:36] [1] Okay.
[02:29:37] [2] Which is, yeah, you know, low-hanging fruit.
[02:29:40] [1] Is this DocuSource?
[02:29:41] [2] Yeah, it's DocuSource. Oh, so maybe we do have it.
[02:29:44] [1] I know a DocuSource docs I want to see one.
[02:29:48] [2] Yeah, yeah.
[02:29:50] [1] No, that's great.
[02:29:51] [2] It might go off DocuSource. It does exactly what I need, you know.
[02:29:54] [1] I know Sebastian and he's super cool, so.
[02:29:57] [2] He's really awesome.
[02:29:58] [1] Yeah. Great.