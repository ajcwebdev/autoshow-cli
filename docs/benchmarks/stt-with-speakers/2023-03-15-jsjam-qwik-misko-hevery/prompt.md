---
title: "2023-03-15-jsjam-qwik-misko-hevery"
slug: "2023-03-15-jsjam-qwik-misko-hevery"
duration: "1:52:52"
channel: "Local"
url: "file:///Users/ajc/c/autoshow-cli/input/2023-03-15-jsjam-qwik-misko-hevery.mp3"
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
[00:00:27] [S1] Welcome.
[00:00:29] [S1] Alright.
[00:00:32] [S1] Yeah.
[00:00:33] [S2] Yo, yo, yo.
[00:00:36] [S1] What's up, what's in there?
[00:00:37] [S1] Hey man.
[00:00:39] [S1] Here we go.
[00:00:43] [S3] Welcome everybody.
[00:00:45] [S4] Oh, how's it going?
[00:00:46] [S3] Welcome to JavaScript Jam Live.
[00:00:52] [S3] We do this every Wednesday at 12 PM Pacific Standard Time.
[00:00:59] [S1] Yes.
[00:01:00] [S2] Oh yeah.
[00:01:02] [S3] And we have a lot of fun.
[00:01:03] [S3] We have some great people to join us.
[00:01:07] [S3] Regulus.
[00:01:11] [S3] There's Jen.
[00:01:11] [S3] She's one of them.
[00:01:13] [S3] She's in here quite often.
[00:01:15] [S3] But yeah, I just wanted to thank everybody for coming today.
[00:01:18] [S3] As wanted to say, whether you're a beginner or whether you're an advanced learner, because what are we?
[00:01:27] [S3] We we are as engineers, as developers, we are lifelong learners, right?
[00:01:34] [S3] So, there we go.
[00:01:42] [S3] It went away.
[00:01:43] [S3] All right.
[00:01:43] [S3] Sorry, I was getting a phone call.
[00:01:45] [S3] I need to put this thing on focus mode, y'all.
[00:01:47] [S3] Come on.
[00:01:48] [S3] I think I'm new to the game.
[00:01:49] [S3] Told you lifelong learner, right?
[00:01:53] [S3] Lifelong learners, that's where we are.
[00:01:55] [S3] And so whether you're a beginner learner or an advanced learner, we just want to say thank you all for coming.
[00:02:01] [S3] And it doesn't matter who you are.
[00:02:02] [S3] Come join us up here on the stage.
[00:02:04] [S3] Just feel free to ask any questions you want, state any facts, opinions, whatever we'd love to hear it.
[00:02:12] [S3] All you gotta do is request to come up and be more than happy to have you on.
[00:02:15] [S3] Uh but we do have today a special guest and we're going to be discussing.
[00:02:21] [S3] I'm sure as you saw from the title there.
[00:02:23] [S3] A little bit about quick.
[00:02:25] [S3] So kind of excited about this one.
[00:02:28] [S3] Anthony, I'm going to go ahead and make an introduction myself real quick and then you can introduce yourself and then me so you can go from there and and we'll get started.
[00:02:36] [S3] I'm excited.
[00:02:38] [S3] So my name is Scott Steinlogging and I am the Technical Community Manager for Edgeo and co-host of JavaScript Jam here.
[00:02:47] [S2] Hello, my name is Anthony Campolo.
[00:02:50] [S2] I am a Developer Advocate at Ezio, and we are super happy to have Mishko here with us.
[00:02:58] [S4] I guess it's my turn.
[00:02:59] [S4] Hi, I'm Mishko.
[00:03:00] [S4] I am a CTO and Builder IO.
[00:03:03] [S4] And yeah, I'm so happy to be here.
[00:03:05] [S4] I'm so happy to chat with everybody.
[00:03:06] [S4] Hi, Jen.
[00:03:07] [S4] I've been on your show before.
[00:03:09] [S4] Yeah, so let's talk about things related to QUIC and web and things of that sort.
[00:03:15] [S2] Yeah, I want to give you a shout out for being on Jen's show because Jen is a wasn't, you know, kind of still was getting into the industry and you went on and taught her how to write a counter, which was for some of your stature is kind of funny, but also shows that you're very humble and willing to work with beginners.
[00:03:36] [S2] I think it really speaks a lot to your character.
[00:03:39] [S4] I am new to this as well.
[00:03:41] [S4] And so happy to be on Jen's show.
[00:03:46] [S2] Cool.
[00:03:47] [S2] Well, yeah, we're going to be talking about QUIC today and any other things you want to chat about with Builder.
[00:03:54] [S2] I've been kind of looking at the Builder.io blog posts and some of the topics that you had recently been looking at that I thought might be interesting to get into.
[00:04:05] [S2] But before we start checking those, checking those out.
[00:04:08] [S2] So we should start with a little bit of your background and the quick 101.
[00:04:14] [S4] Yeah, sure, we're happy to jump into that.
[00:04:17] [S4] Background, let's see.
[00:04:19] [S4] I actually I actually have a degree in computer engineering, which is kind of weird because the thing that I got my degree in is how transistors work.
[00:04:32] [S4] All the way low level CPUs work and the lowest possible level you can imagine.
[00:04:37] [S4] And somehow, over the years, I have slowly transitioned to higher and higher level.
[00:04:43] [S4] Because computers are just a bunch of abstractions all the way to the to the top.
[00:04:47] [S4] And so somehow I ended up in the web, which is pretty high abstraction, right?
[00:04:52] [S4] And normally when you type A plus B or something like that instead of your web browser, you don't really think about what all the insanity happens underneath.
[00:05:00] [S4] to add two numbers together.
[00:05:02] [S4] So yeah, I have kind of a strange background.
[00:05:04] [S4] I actually kind of like it because I kind of joke that I'm probably the only JavaScript engineer that knows how transistors work.
[00:05:09] [S4] I'm sure there's plenty of others, but it's not a common thing.
[00:05:13] [S4] in this.
[00:05:13] [S3] Hey, I love working on some things.
[00:05:16] [S3] I have personally soldered some some custom boards together with capacitors, resistors, chips, Yeah.
[00:05:26] [S5] Yeah.
[00:05:26] [S5] There you go.
[00:05:27] [S3] Interesting thing.
[00:05:28] [S3] So.
[00:05:28] [S3] There you go.
[00:05:29] [S4] Um I used to have a big booster of a chip I laid out over my bed.
[00:05:35] [S4] Um but my girlfriend, now my wife, she decided that that didn't really fit the bedroom.
[00:05:41] [S4] So it's no longer there.
[00:05:45] [S3] Nice.
[00:05:46] [S4] But anyways, so somehow I ended up in web technologies.
[00:05:50] [S4] And I actually went work at Adobe.
[00:05:53] [S4] And there I learned Flex and Flash.
[00:05:56] [S4] And then I ended up at Google.
[00:05:57] [S4] And I kind of learned that building web apps is just a big marshaling problem of how do you get your data from the UI to the database and back from the database back to the UI.
[00:06:09] [S4] And so this is where I kind of work a little bit on Angular and Angular.js and Angular.
[00:06:13] [S4] And I've done that for a pretty long time.
[00:06:16] [S4] And then like two years ago or three years ago, something like that, I was just like, I just need to try something new, something different.
[00:06:22] [S4] Either that or I'm going to become institutionalized.
[00:06:24] [S4] And so I kind of went out and looked for a bunch of other things.
[00:06:29] [S4] I ended up at Builder.io.
[00:06:30] [S4] They what really spoke to me is this idea of no code editor.
[00:06:34] [S4] What Builder IO does is basically I'm sure you guys are familiar with Wix.
[00:06:38] [S4] Wix allows you to kind of drag and drop editor for building websites, right?
[00:06:42] [S4] But Wix, for forces all of that to be you have to host it with Wix.
[00:06:47] [S4] You cannot take the site and put it in a custom application or something like that.
[00:06:52] [S4] And so with Builder.io, it's kind of the same exact idea as Wix, except that you can actually embed it into your custom React Angular View Solved, quick application.
[00:07:02] [S4] And I think that's kind of what's kind of unique and interesting.
[00:07:06] [S4] Anyway, so while at Builder, I I came to to my old habits, so to speak.
[00:07:14] [S4] And I was just like, we need to make the web faster.
[00:07:18] [S4] What's going on is just craziness.
[00:07:20] [S4] It's too slow.
[00:07:21] [S4] And you know, the big kind of realization is like, well, it's relatively simple in the sense that the performance or the startup performance of the site is just proportional to how much JavaScript the website has to execute at the beginning right?
[00:07:36] [S4] And so if you decrease the amount of JavaScript you execute, then your site obviously starts up faster.
[00:07:41] [S4] And so QUIC kind of became this journey on how do you not ship so much JavaScript to the browser.
[00:07:48] [S4] And so that's where we are today.
[00:07:52] [S2] Nice.
[00:07:53] [S2] Yeah.
[00:07:53] [S2] I find that this is very much in the zeitgeist right now with JavaScript.
[00:07:58] [S2] A lot of people are concerned with performance both in the framework world and outside the framework world.
[00:08:05] [S2] I think it's interesting you look at someone like Alex Russell.
[00:08:08] [S2] He's really giving a similar message to you, but he is saying less so that you know, we should have a performance framework so much as we shouldn't have a framework at all.
[00:08:20] [S2] Or you should, you know, kind of build your own bespoke one for the needs of your specific project.
[00:08:26] [S2] So why do you feel that we should architect these frameworks to be performant instead of just using native web components?
[00:08:36] [S4] I think a lot of people are coming to the same exact conclusion.
[00:08:39] [S4] And the conclusion is that there is too much JavaScript, right?
[00:08:43] [S4] It's kind of a like obvious conclusion, but it's also a conclusion that is kind of difficult to be actionable.
[00:08:50] [S4] You know, I was kind of joked that when you go to Google Lighthouse score, right?
[00:08:56] [S4] It tells you, decrease the amount of JavaScript.
[00:08:58] [S4] And it's like, yes, yes, I understand that.
[00:08:59] [S4] But like, how?
[00:09:01] [S4] Like, what's the magic button that I can push to get less JavaScript, right?
[00:09:06] [S4] It's kind of like, you know, you go to somebody and they says, well, you know, I decided that your problem is that you're poor.
[00:09:11] [S4] So you just have to make more money.
[00:09:12] [S4] It's like, yeah, I get it.
[00:09:13] [S4] But like, how?
[00:09:15] [S4] Like, what's the magical thing to do here?
[00:09:18] [S4] And so I think what Alex a lot of times talks about is this idea of like, let's just be more frugal about things.
[00:09:26] [S4] And I think being frugal is kind of difficult.
[00:09:29] [S4] Like, yeah, I get it.
[00:09:31] [S4] Like, you could be more frugal and be more careful, etc.
[00:09:34] [S4] But on the day, we have things to deliver.
[00:09:36] [S4] We have other distractions, etc..
[00:09:38] [S4] And so we just want the tools to solve this for us.
[00:09:41] [S4] And so my take on the whole thing is that our tools should be helping us.
[00:09:46] [S4] And I think we're kind of in a world where the tools are somewhere between not helping and actually actively trying to sabotage us.
[00:09:55] [S4] It's not intentional.
[00:09:57] [S4] It's not like we intentionally designed these tools this particular way.
[00:10:00] [S4] But we kind of ended up in this world because we didn't really understand the web ecosystem or the web world.
[00:10:08] [S4] And we came to the web world from kind of the desktop application world, right?
[00:10:13] [S4] Like a desktop application world, like the concept of lazy loading is just not much of a thing.
[00:10:17] [S4] And so you don't really design your framework to kind of take this into account.
[00:10:22] [S4] And if you look at most lazy loaded frameworks today, like most frameworks today, the way they have lazy loading.
[00:10:28] [S4] It's true, they have that.
[00:10:29] [S4] But it's a kind of, I would say, an afterthought.
[00:10:32] [S4] It's not lazy loading was never inside of version one of any of these frameworks.
[00:10:37] [S4] Lazy loading was something that was added later on.
[00:10:39] [S4] Because it was added later on, it's it's not like the core primitive of what these things do.
[00:10:46] [S4] And so there's like all kinds of, you know, I would say, clever ways of of lazy load the code.
[00:10:52] [S4] But but all of them essentially have this particular problem.
[00:10:56] [S4] And that is that you can only lazy load code that is currently not needed, which seems kind of obvious.
[00:11:03] [S4] But what it means in practice is that if you have a component that is currently on your page, you have to lazy load the code for the component, even though the component might not be doing anything, might not have any behavior, or it might already be rendered and that needs to be rendered again.
[00:11:19] [S4] But just the way the existing tools work and the way hydration works, that code has to be present in the client.
[00:11:26] [S4] And so, you know, the the mental exercise that Qwik is trying to do is to say, like, how do we delay the code as much as possible?
[00:11:36] [S4] And just take it to an extreme and have the tools just do it automatically.
[00:11:41] [S4] So as a developer, you just don't have to think about it.
[00:11:46] [S2] Awesome.
[00:11:46] [S2] I'll give a shout out to Rais, who just joined us.
[00:11:50] [S2] You want to introduce yourself?
[00:11:52] [S6] Hey, yeah, sorry.
[00:11:55] [S6] My name is Rais.
[00:11:56] [S6] I am the product manager for Edu Sites.
[00:11:59] [S6] I work at Edu with the with Anthony and Scott and some other people here.
[00:12:05] [S6] Yeah.
[00:12:07] [S6] Just just listening in and and being inspired.
[00:12:12] [S6] I have a couple of questions that I'll say for a little bit.
[00:12:16] [S2] Yeah, I actually, I told Rais, he should definitely make it for this one because he's someone who actually has worked.
[00:12:22] [S2] quite deeply with Quik and has kind of scoped it out for some production apps.
[00:12:28] [S2] So I was like, you should definitely hop up here and ask some questions when you have it.
[00:12:32] [S2] Yeah, feel free to jump in at any point.
[00:12:34] [S2] We're just doing kind of like the QUIC 101 right now.
[00:12:37] [S2] And then we'll get into some deeper questions as we go.
[00:12:40] [S2] So we talked about QUIC.
[00:12:41] [S2] We've talked about kind of the problem it's meant to solve.
[00:12:45] [S2] And it seems like it's aiming for a similar thing to partial hydration, how do we manage the amount of JavaScript we have, same thing with server components.
[00:12:56] [S2] So there's a lot of different ways that we're trying to approach this problem.
[00:13:01] [S2] And then there's also quick city as well.
[00:13:04] [S2] So you should talk a little bit about how quick city fits in here.
[00:13:08] [S4] Yeah, we can talk about that.
[00:13:09] [S4] But first, sorry, I'm going to be a little bit of a stickler, and I will try to very politely correct something here you just said.
[00:13:17] [S4] You said partial hydration.
[00:13:20] [S2] Well, I know it's not partial hydration.
[00:13:21] [S2] I'm saying they're both the thing you're doing and the thing partial hydration are doing are trying to solve the same problem but I know they're doing it differently.
[00:13:28] [S2] So you can go and go into that.
[00:13:30] [S4] No, no, no, absolutely.
[00:13:31] [S4] Yeah, no, it's a I just wanted to make it clear like it's a different it's a it solves the same problem, right?
[00:13:35] [S4] The problem you're trying to solve is way too much JavaScript is being executed on initial page navigation.
[00:13:42] [S4] That's the fundamental problem you're trying to solve.
[00:13:44] [S4] And there's a lot of different approaches you could take.
[00:13:48] [S4] And QUIC was basically designed from ground up to delay execute the code extremely aggressively as much as possible.
[00:13:56] [S4] And that's kind of its trick.
[00:13:58] [S4] That's the thing that it's trying to do.
[00:14:00] [S4] And the argument here is that if you can do that, then you can greatly lower the amount of JavaScript.
[00:14:06] [S4] So anyways, so Quick City.
[00:14:09] [S4] Yeah, let's talk about Quick City.
[00:14:10] [S4] So we built Quick, and we originally didn't want to go into the business of building a Meta framework.
[00:14:17] [S4] We were kind of hoping that we could either reuse Next.js or Remix or one of the existing meta frameworks that are currently out there.
[00:14:25] [S4] But it turns out there is a lot of details that matter.
[00:14:30] [S4] And so whether we like it or not, we ended up building a Meta framework that can take advantage of Quick.
[00:14:38] [S4] And the one way to kind of think about it is Quick City is kind of like Next.js to React.
[00:14:44] [S4] So Quick cities to quick in the same way.
[00:14:47] [S4] But it solves, it takes the problem in a slightly different way.
[00:14:52] [S4] What's unique about quick city and quick is that the frameworks, or you can really think about it together as just quick, What's unique about it is that they really want to solve the whole problem end to end.
[00:15:01] [S4] What I mean by whole problem end to end is how do you make the bundles?
[00:15:05] [S4] How do you break up your code?
[00:15:07] [S4] How do you lazy load the code?
[00:15:09] [S4] How do you make sure that the lazy loading is pre-cached so that you don't have hiccups on a small network or intermittent network.
[00:15:18] [S4] How do you serialize the data?
[00:15:19] [S4] How do you serialize the data on the other side?
[00:15:20] [S4] How do you wake up the application?
[00:15:23] [S4] Basically, all of those pieces that are related are solved as a cohesive problem set.
[00:15:29] [S4] Whereas if you look at the existing systems, they solve the parts in pieces, or maybe they don't.
[00:15:36] [S4] So for example, Next.js doesn't really it relies on existing technologies to create bundles.
[00:15:44] [S4] But but because it relies on existing technologies, it means that as a developer, if you want to have a laser loaded boundary, you have to think about it.
[00:15:50] [S4] You have to put a dynamic import somewhere in your code base.
[00:15:53] [S4] And if you don't put that in, well, then that particular bit can't be lazy loaded.
[00:15:58] [S4] Whereas with Qlik, you don't have to think about it.
[00:16:01] [S4] It's just automatic.
[00:16:02] [S4] And natural.
[00:16:03] [S4] So so the problem we're trying to solve is that we would like to have an environment where the whole part of serving a web application in the fastest possible way, is something that is available to you sold out of the box.
[00:16:17] [S4] You don't have to think about it as an afterthought.
[00:16:22] [S4] Awesome.
[00:16:23] [S2] Welcome to the stage, Daniel.
[00:16:25] [S2] Did you have a question for Michel?
[00:16:31] [S2] And if they're not here right now, Rais, if you want to hop in with any of your questions, feel free.
[00:16:36] [S6] Yeah.
[00:16:36] [S6] So actually, as Anthony mentioned, I actually built a production website, a small production website with Quick.
[00:16:46] [S6] And while while we were actually building that, some of the APIs changed and I was trying to basically see the documentation in GitHub and see what is going on with the APIs.
[00:17:01] [S6] And I found out that you guys are working on the server, server closure, I think is called or something.
[00:17:10] [S6] I would love to get to know what was the motivation behind that.
[00:17:14] [S6] It seems seems like it should have been done by other people as well.
[00:17:21] [S6] You know, are other people other frameworks doing it as well?
[00:17:25] [S6] Or is quick city the first one to do this?
[00:17:29] [S6] And what was the, you know, what was the inspiration for that?
[00:17:33] [S4] Yes, I believe you're talking about server dollar sign, right?
[00:17:35] [S6] Yeah.
[00:17:36] [S6] Yeah.
[00:17:36] [S4] Okay.
[00:17:38] [S4] Yes.
[00:17:38] [S4] So I think there is a general trend towards what I call code co-location.
[00:17:43] [S4] This idea that as a developer, we have some codes that run runs on a server and some code that runs on the client.
[00:17:50] [S4] But we don't really want to think of it as two separate things.
[00:17:52] [S4] We really want to just have a single code base.
[00:17:54] [S4] So we want to co-locate our server code together with our client code.
[00:17:58] [S4] And if you look at it, an existing framework to do this, you can look at Next.js, there's the get server props.
[00:18:04] [S4] If you look at Remix, I forget off the top of my head what they have, but they have a similar mechanism where you can fetch data.
[00:18:10] [S4] And basically, all meta frameworks have a mechanism by where you can essentially execute code that is server only code, meaning it talks to a database or a file system, something that can never be on the client.
[00:18:22] [S4] But have a way of making sure that when the bundles are created, that code doesn't end up in the client.
[00:18:29] [S4] And so so this is a trend that I think already has existed for a while.
[00:18:34] [S4] Nothing has changed in it.
[00:18:35] [S4] And so I think what we're looking for is just a more natural way of mixing server and the client code.
[00:18:42] [S4] So once we get server props, once that can get started, other people have kind of tried to push this idea even further.
[00:18:50] [S4] So like trpc is another example of like, hey, I have server code.
[00:18:54] [S4] I have client code.
[00:18:55] [S4] How do I make sure that the type information flows through it, and so on?
[00:18:59] [S4] Before something like TRPC, type information wouldn't flow between the server and the client.
[00:19:04] [S4] And so if you just take this idea even further, then you end up something with a server dollar sign, where you can, you have a underlying system that knows how to break up your code in such a way so that you don't accidentally ship server server code to the client.
[00:19:21] [S4] But it's written in such a way where the semantic meaning of what server side dollar is, is is kind of left in the user space, in the developer space, meaning that you know, I could implement server dollar sign, or I can implement worker dollar sign, or I could implement, you know, anyone, only one of others of these, you know, load data on a server dollar sign, kind of a thing.
[00:19:43] [S4] And so what Qwik kind of, I think, pioneered, is kind of unique to Qwik, is this idea that you have a marker function that can take code and break it apart so that you, as a developer, can decide, well, what does it mean for these two parts to do?
[00:19:59] [S4] Do I execute the part in the same location or the location on the other side, etc.?
[00:20:05] [S4] And so we call this idea code collocation and code extraction.
[00:20:09] [S4] And And so server dollar sign actually kind of fits an interesting niche, where you want to just make a call on a server.
[00:20:17] [S4] And so you want to have a simple way of doing it.
[00:20:20] [S4] But you don't necessarily want to reach to something more heavyweight like TRPC.
[00:20:24] [S4] Like TRPC has other advantages in that you can have kind of a different client, sort of different teams working on the API side and different team working on the client side.
[00:20:35] [S4] There's a backwards compatibility story.
[00:20:36] [S4] And they're saying that you have to make sure that you don't accidentally because there's a version skew between the version that's in the browser versus the version that's on a server.
[00:20:44] [S4] You want to change your APIs in such a way so they're compatible, right?
[00:20:48] [S4] So so tRPC allows you to do all of these fancy things.
[00:20:51] [S4] But maybe sometimes you don't need it.
[00:20:53] [S4] Sometimes you just want something quick and simple to kind of get you moved on from it.
[00:20:58] [S4] And so something like Super Dollar Sign is an interesting stop gap measure.
[00:21:02] [S4] So what we're doing is we're making it easy for people to co-locate server and the client code together in the same file, and making it easy for us to communicate between that.
[00:21:13] [S4] And for, we think, for like 90% of the use cases is good enough.
[00:21:17] [S4] And for the more complicated 10% of the use cases, well, there are other tools out there that you can kind of hop in and use.
[00:21:26] [S4] And I think ICTO is also over here.
[00:21:28] [S4] And I know Theo was pretty outspoken about tRPC and how.
[00:21:32] [S4] So you can probably jump in and have some opinions as well.
[00:21:37] [S2] Looks like Daniel's got his hand up.
[00:21:38] [S2] You want to hop in?
[00:21:42] [S7] Hello, good evening.
[00:21:43] [S7] Um, sorry, good evening from Nigeria.
[00:21:46] [S7] So, um, I have a question.
[00:21:49] [S7] I write ehm, Python and ehm, I read that for artificial intelligence.
[00:21:53] [S7] But is it possible for someone to write AI with JavaScript?
[00:21:58] [S7] Is it really possible?
[00:21:59] [S7] I know you can write it with C plus puzzle and Python, but is it possible with JavaScript?
[00:22:04] [S4] This is not my area of expertise.
[00:22:07] [S2] I could answer
[00:22:08] [S4] That, but go go for it.
[00:22:09] [S4] Yeah.
[00:22:10] [S2] Yeah.
[00:22:10] [S2] So I mean, so when you're talking about like AI, there's different things you can kind of talk about here.
[00:22:17] [S2] So there's actual training, like models themselves, which is typically done in Python.
[00:22:24] [S2] But you can do some of this in JavaScript.
[00:22:26] [S2] There's a JavaScript, like TensorFlow library, or you can write JavaScript code that's going to hit like an API, like OpenAI's API.
[00:22:37] [S2] And with that, you can write a JavaScript application that will be hitting essentially the AI kind of services.
[00:22:44] [S2] So for the most part, that's what you you'll be doing.
[00:22:46] [S2] You won't really be coding so much direct AI stuff itself in JavaScript, but you still work with AI tools in the language of JavaScript.
[00:22:55] [S2] Does that make sense?
[00:22:58] [S7] Yeah, kind of.
[00:22:59] [S7] But, you know, trying to do stuff like a convolutional neural network or a computer vision project, you know, I haven't learned stuff like JavaScript and I have full interest with with AI.
[00:23:11] [S7] I've been working with L for quite a long time, just using Python.
[00:23:14] [S7] So I don't just know, I think I know of Java, TensorFlow.js, but I don't even can do everything Python can actually do.
[00:23:23] [S7] Just sounds weird.
[00:23:25] [S7] I don't know.
[00:23:28] [S2] Yeah.
[00:23:29] [S2] Yeah, I mean, we're not really AI experts up here, unfortunately.
[00:23:33] [S2] So I think that's probably about all the words of wisdom we can give you.
[00:23:37] [S2] It's like um, Theo got your hand up.
[00:23:41] [S8] Eddie, I wanted to chat a bit about the TRPC stuff just because I, I agree with parts, but not necessarily the whole.
[00:23:48] [S8] I think the, the framing that I've grown to take on is like, what's the distance between your backend and your front end in a developer experience or way, where like colocation is obviously a huge, like when in that the backend code that your friend uses is right there.
[00:24:06] [S8] And when you use a primitive like server dollar sign to like generate those functions, you end up with a lot of the like type safe behavior that you would expect from just writing calling functions in TypeScript.
[00:24:16] [S8] traditionally.
[00:24:18] [S8] I find that when we look at stuff like REST and GraphQL, there is an abstraction there that makes the distance between the backend and front end code feel much greater.
[00:24:26] [S8] And you have a much more mental overhead to work with when you're making those types of changes in between that relationship.
[00:24:34] [S8] The benefit of that cost is that you now have a back end that can be used for multiple purposes across multiple clients.
[00:24:40] [S8] And the split actually makes the team split better, too.
[00:24:43] [S8] One of the points Mr.
[00:24:43] [S8] Covey that I don't necessarily agree with is that tRPC helps like the backend and front end teams be separate.
[00:24:49] [S8] I actually think it's uniquely poor in that, in that like, TRPC is a first class backend for front end.
[00:24:56] [S8] What we're describing here with server dollar sign is a first class back end primitive in your front end.
[00:25:02] [S8] And I think the distance between those two things is not very great.
[00:25:06] [S8] Like I would consider tRPC closer to a server dollar sign type thing than I would to GraphQL, simply because command click go to definition works as expected.
[00:25:16] [S8] And I think the the magic of tRPC isn't that it's more like GraphQL or more like an RPC.
[00:25:22] [S8] It's that it represents this unique in between where you get a lot of the DX wins from both and the ability to use your server across multiple platforms and clients.
[00:25:33] [S4] I just want to add something.
[00:25:35] [S4] I agree with everything you said.
[00:25:37] [S4] Do you think it would be a good characterization that you kind of have layers, right?
[00:25:41] [S4] Server dollar is by far the closest in the distance, and then tRPC is a little further away, but still we're pretty close.
[00:25:48] [S4] And then GraphQL would be like kind of the furthest up there, right?
[00:25:53] [S8] Exactly.
[00:25:54] [S8] This is the framing I've been trying to take on more.
[00:25:56] [S8] And while doing it, show the benefits that you get as you leave like further out the circle.
[00:26:01] [S4] Yeah, it's a trade off, definitely.
[00:26:06] [S2] Awesome.
[00:26:06] [S2] Looks like we got real 007 has their hand up.
[00:26:09] [S2] I think this is a first time caller.
[00:26:14] [S6] Hello.
[00:26:15] [S2] Hey.
[00:26:17] [S9] Hey guys.
[00:26:17] [S9] Uh my name is Tino and I have a a tricky question for me.
[00:26:22] [S9] I don't know if you can answer.
[00:26:25] [S9] So my question is, as far as I know, quick and quick city are still in beta.
[00:26:31] [S9] What are they waiting for in order to hit vision 1.0?
[00:26:36] [S9] What is that one thing that they are waiting for?
[00:26:39] [S9] I don't know if Mishko can answer this or not.
[00:26:41] [S4] Yeah, I can definitely try.
[00:26:44] [S4] I think what we're missing mainly is documentation and kind of polish.
[00:26:50] [S4] What we want is we want people to have a good experience.
[00:26:52] [S4] right?
[00:26:52] [S4] So if you come in and you type in quick create project and do basic operations, it should all kind of work.
[00:27:00] [S4] And right now, we're still getting lots of feedback from the community of like kind of sharp edges where things work, but you've got to watch out for this and that, etc..
[00:27:09] [S4] And so from our point of view, it is not a high enough standard that we have reached.
[00:27:14] [S4] But we would like to get to version 1.0 pretty pretty soon.
[00:27:18] [S4] Of course, with like anything related to versioning and guesses about the future, you're always wrong about it, right?
[00:27:23] [S4] So I'm not going to pick a specific date, but I'm just going to say we're getting pretty close.
[00:27:29] [S9] Okay, okay.
[00:27:29] [S9] No, thank you so much for your time.
[00:27:35] [S2] Also, hello to Ellery.
[00:27:38] [S2] You got any questions for the space?
[00:27:42] [S10] Uh, no, nothing yet, but I will definitely raise my hand eventually.
[00:27:46] [S10] Cool.
[00:27:48] [S2] Actually, Jen's coming up.
[00:27:50] [S6] Yes, since since everybody is here, it reminds me one of our actually one of our largest clients at Ageo is interested in they're very interested in trying out quick.
[00:28:05] [S6] And you know, think about their websites some of their websites are probably some of the largest e-commerce websites by revenue on the internet.
[00:28:18] [S6] And one of the, one of the problems that we're running into is the existing websites are built in multiple different kinds of kinds of frameworks, or you can say backends.
[00:28:30] [S6] One would be Next.js, another is Salesforce Commerce Cloud or something else.
[00:28:36] [S6] And it's just the translating of all the work you've already done in Next.js and and React into quick.
[00:28:46] [S6] It's like a huge basically you have to rebuild everything And the the advantage you have with React is there's a huge amount of community work that's available that you can use.
[00:28:59] [S6] And that is not um, not available as much with quick.
[00:29:05] [S6] So, you know, in, in general, I'm just asking like, how are you seeing the, um, the community work for quick and quick city and, you know, are you seeing any like how's the how's the trend graph going for the for, you know, open source components?
[00:29:25] [S4] Yeah, I mean, uh, quick is pretty new.
[00:29:26] [S4] So obviously our communities know nowhere close in size to to React.
[00:29:31] [S4] But I think QUIC offers some pretty compelling value propositions in here.
[00:29:36] [S4] And so people who really want to make sure that their sites are fast and places like e-commerce is a perfect example for this, I think might want to explore it.
[00:29:44] [S4] Now, to help with these, we do have Quick React, which allows you to take existing React components and wrap them in Quick.
[00:29:52] [S4] Obviously, you're not going to get all the magical benefits out of the box.
[00:29:55] [S4] There is basically Quick React is essentially creating island architecture.
[00:30:00] [S4] You delay hydrating those particular components that are Quick React components.
[00:30:06] [S4] So it's not reasonability.
[00:30:07] [S4] But at least you can kind of work on it together.
[00:30:10] [S4] When I talk about kind of advantages and disadvantages of different technologies, I like to talk about things like intrinsic and extrinsic factors.
[00:30:18] [S4] And so to me, like the fact that Quick's community and Quick's documentation and the know how, etc., are obviously not as high as somebody who's been around for much, much longer.
[00:30:30] [S4] To me, these are all extrinsic factors.
[00:30:32] [S4] Meaning, these are things that will change over time.
[00:30:34] [S4] These are not like fundamental properties of a particular technology, which is kind of what intrinsic property would be of the system.
[00:30:43] [S4] So yeah, we have a if you want to use QUIC today, you kind of have to really understand the value proposition you're going after and say, hey, this is this is worth the trouble.
[00:30:57] [S4] Because there isn't yet this support system that we have.
[00:31:01] [S4] Having said that, I think we have quite a lot of things already.
[00:31:04] [S4] If you go to the quick website, there's a showcase where actually we're just rebuilding this to making it easier.
[00:31:10] [S4] But I think we have quite a lot of existing community support.
[00:31:16] [S4] I'm just chatting with people who are doing image components, who are doing form support, who are trying to do existing component libraries for Qwik.
[00:31:26] [S4] Of course, you can just wrap material components and so on.
[00:31:29] [S4] So a lot of things I think is happening.
[00:31:31] [S4] Authentication with different auth providers.
[00:31:34] [S4] A lot of things is happening, but it's just going to take some time, right?
[00:31:37] [S4] And so we're at the beginning of the stage, right?
[00:31:39] [S4] We're not even at version 1.0.
[00:31:44] [S10] Yeah, I could just follow on to that.
[00:31:48] [S10] So I think like QUIC has probably the most correct architecture.
[00:31:52] [S10] If you put a gun to my head and said which thing is the right way to build a website, I'd probably pick quick.
[00:31:57] [S10] One thing that we did for this particular client is they're built on Next.js, as Rice mentioned.
[00:32:03] [S10] So we said, all right, let's take some lessons learned from QUIC and see what we can implement in Next.js without a full rewrite.
[00:32:08] [S10] So we did a little POC recently where we said, let's try to go very aggressive with bundle splitting.
[00:32:14] [S10] So let's dynamically import all of the things basically.
[00:32:18] [S10] And let's defer even downloading the JavaScript from the client until certain components have been interacted with.
[00:32:27] [S10] And this had the expected impact that we anticipated for TBT.
[00:32:31] [S10] So total blocking time had a huge spike in performance.
[00:32:36] [S10] But then what we did see, there were some visual issues.
[00:32:38] [S10] So one example was when you clicked on the hamburger menu on mobile, and you expected to navigation OAP to open up.
[00:32:46] [S10] You have all these flyout menus, images that load in, components, fonts, etc..
[00:32:50] [S10] There was a visible delay.
[00:32:52] [S10] I'll put it that way.
[00:32:54] [S10] We aren't talking a half second, but maybe 100, 200 milliseconds of delay.
[00:32:59] [S10] So you would tap and you would like, it was long enough that you would be like, did I really tap that?
[00:33:03] [S10] I'm not sure.
[00:33:04] [S10] And then it would show up.
[00:33:05] [S10] So I'm not sure if you or other people have seen any issues where this aggressive code splitting and dynamically loading JavaScript on interaction has had any adverse user experience impacts?
[00:33:18] [S4] Yeah, that's a good question.
[00:33:19] [S4] Actually, a lot of people ask that.
[00:33:20] [S4] So absolutely, If you lazy load code on interaction, you will see that.
[00:33:27] [S4] And that's going to be a problem.
[00:33:29] [S4] This is why we actually have ways of mitigating this.
[00:33:32] [S4] And I think what you're discovering is that you're trying to take the lessons learned from Qwik and trying to apply it to an existing system.
[00:33:40] [S4] And then the existing system is really not really cooperating, because it wasn't designed for this particular bit.
[00:33:47] [S4] So the way Qwik solves this particular problem is that we have a service worker.
[00:33:51] [S4] And the service worker's job is to prepopulate the cache.
[00:33:54] [S4] So when the user goes and clicks on a hamburger menu, and the framework starts lazy loading the code and lazy executing the code associated with the hamburger menu, the code is already in the sitting cache.
[00:34:08] [S4] And therefore, you don't have the 200 millisecond delay.
[00:34:11] [S4] It's basically instant.
[00:34:13] [S4] And so if you look at existing systems, like for example, you lazy loaded everything, you discovered like, hey, now you have to solve the next problem.
[00:34:21] [S4] And the next problem is making sure that the cache has the right assets.
[00:34:26] [S4] And existing frameworks will not do anything to help you in this department.
[00:34:31] [S4] It's up to you as a developer to write this.
[00:34:33] [S4] Whereas in Qwik, we thought about this problem and said, hey, yes, if you start executing code lazily, you will have a problem of delay.
[00:34:42] [S4] How do we make sure that that doesn't happen?
[00:34:43] [S4] Well, we have to make sure that certain bundles get eagerly downloaded and placed inside of the cache so that when the user does interact, there is no delay available to them.
[00:34:54] [S4] And to do that, now you have to you're in the business of knowing, like, so which bundle contains which code?
[00:34:59] [S4] And which order should the bundles be downloaded?
[00:35:02] [S4] Do I download all the bundles or only some of the bundles?
[00:35:04] [S4] And so, again, existing frameworks just have no opinion on this particular matter.
[00:35:10] [S4] And this is where QUIC has an opinion.
[00:35:12] [S4] So QUIC can keep track of the the usage of what the user does.
[00:35:17] [S4] And based on that, you can provide statistical information to you as a developer that says like, ah, people normally click on this button first.
[00:35:24] [S4] So you make sure you download the bundle with that thing available first.
[00:35:27] [S4] And and all of this information as to what bundles to download, in which order, etc., all of that becomes just configuration information too quick.
[00:35:35] [S4] That is relatively easy to kind of tweak and improve.
[00:35:38] [S4] Whereas if you wanted to change the way the bundles are structured in the existing system, you actually have to go to the source code and either add more dynamic imports or remove dynamic imports.
[00:35:48] [S4] It's not something that's just automatic.
[00:35:50] [S4] So again, I think you're discovering the case of like, yes, I'm going to trick some of the ideas that Qwik has, and I'm trying to implement them in the existing systems that are really not designed for this.
[00:36:01] [S4] And I'm running into all kinds of kind of problems or surprises.
[00:36:04] [S4] And now these problems or surprises are your problem as a developer.
[00:36:08] [S4] They're not the framework's problem.
[00:36:10] [S4] And I think that's kind of the big difference with Qwik, is that with Qwik, like, no, this is the frameworks problem.
[00:36:15] [S4] And so you don't have to think about it as a developer.
[00:36:20] [S4] Hopefully, that hits it and answers it.
[00:36:23] [S10] No, that does answer the question.
[00:36:24] [S10] I need to peruse the docs a little bit and see if I can figure out the service worker magic.
[00:36:28] [S10] I mean, not that I'm unfamiliar with service workers, but just understanding how at compile time or runtime, we're determining what bundles or scripts should be loaded eagerly.
[00:36:37] [S10] because their user interaction will depend on them and making sure that they're available.
[00:36:42] [S2] Yeah, so I had two of our two blog posts to the top that are related to this.
[00:36:47] [S2] If you want to speak about a little more Mishko Yeah, perfect.
[00:36:50] [S4] Yes, yes, yes.
[00:36:52] [S4] Yeah, so we call it the speculative fetching of code.
[00:36:55] [S4] In order for this to actually work, you need an interesting part, which is, you know, I keep discovering that, like, QUIC has these concepts that don't have an analog in other frameworks.
[00:37:05] [S4] So for example, one of the concepts that we have in QUIC is this idea that the framework at runtime understands the graph of all the objects, meaning it understands what bundles exist in the system.
[00:37:18] [S4] And it understands, like if I load bundle A, I will also have to load bundle C.
[00:37:23] [S4] And if I want to get a click listener for this particular button, then I know that it's going to be found in bundle, whatever, G or something like that.
[00:37:31] [S4] So the framework itself understands the graph of of kind of the the bundles and the symbols available inside of it.
[00:37:41] [S4] And there is no equivalent like that in existing systems.
[00:37:43] [S4] Like in existing systems, if you take your source code and you feed it through a bundling system, the bundling system doesn't tell you anything about how the bundles are related, what symbol ended up where, you're kind of on your own.
[00:37:57] [S4] And it turns out that having that information, having that graph, is what then enables you to do other things, such as speculative loading of code, so that when a user finally clicks on a button, you know that it's going to the code is going to be waiting for the user in the cache and there will be no delay.
[00:38:13] [S4] There will be nothing visual that is kind of annoying.
[00:38:24] [S2] Yo Jen, do you have any questions?
[00:38:28] [S11] I do have to remember my question now.
[00:38:32] [S11] And hello.
[00:38:34] [S2] Why don't you introduce yourself real quick while you're thinking of it?
[00:38:37] [S12] Yeah, I guess this is
[00:38:38] [S11] The exciting time.
[00:38:39] [S11] And Mishko, thank you for being on the show eight months ago.
[00:38:43] [S11] It's crazy to think about that.
[00:38:46] [S11] My name is Jenna Janot.
[00:38:48] [S11] I am a developer advocate at Ivan, a data infrastructure company.
[00:38:53] [S11] And I also have two shows, one called Teach Jantech, where I first met Anthony and Mishko.
[00:39:00] [S11] They have both been on the show.
[00:39:02] [S11] And I also oh, and I see Nick.
[00:39:04] [S11] Nick's been on the show too.
[00:39:06] [S11] And I also have a show called Shit You Don't Want to Talk About, where we talk about mental health and neurodiversity.
[00:39:14] [S11] And yeah, it's been a I had no idea any coding back in July 2022.
[00:39:21] [S11] So we're almost to a year.
[00:39:23] [S11] We are almost there.
[00:39:24] [S11] And for those who might not have been here at the very beginning of the space, Anthony was complimenting Mishko on coming on my show.
[00:39:34] [S11] And teaching me what quick was when I didn't know what Hacker News was.
[00:39:42] [S2] What was your impression of kind of learning quick at the time?
[00:39:45] [S2] Did it seem like overwhelming or did it feel like just kind of learning another thing like you like the way you learned React?
[00:39:51] [S2] Because I feel like with beginners, you know, you can kind of give them any framework and start teaching them.
[00:39:57] [S2] They're all going to be equally confusing, you know?
[00:39:59] [S2] So I feel like quick might have been just like another framework for you.
[00:40:06] [S11] Yes, although I would say when we started going in to the DevTools and looking at the load times to compare them, it made a lot more sense because my previous time was at GoDaddy.
[00:40:24] [S11] And of course, I always heard of people like hating that their websites were loading really slow.
[00:40:30] [S11] So it was really cool.
[00:40:31] [S11] to see how, like, the website only loaded what it needed to load instead of absolutely everything when that could slow down a website.
[00:40:47] [S2] Nice.
[00:40:47] [S2] Yeah, that is.
[00:40:48] [S2] That's the idea.
[00:40:49] [S11] But I do remember my question because I was super excited lately that I'm building.
[00:40:56] [S11] I built one website.
[00:40:57] [S11] in Astro and now I'm building another site in Astro.
[00:41:00] [S11] And I was like, you know, I should probably try a different framework, eventually.
[00:41:04] [S11] And I just saw on Builder that you can do quick
[00:41:10] [S13] With Builder
[00:41:10] [S11] So now I'm really excited to try that one out.
[00:41:13] [S11] But this question is for all of you.
[00:41:15] [S11] Like what app would you say to anybody to build their sites with or build things with to be able to test out and really see the differences frameworks?
[00:41:30] [S4] You know, that's a hard question because I feel like the differences between frameworks don't really come to be until your application gets ridiculously large.
[00:41:41] [S4] The thing is, any any framework, when you build a Hello World or ToDoList or MovieXap or any of those basic ones, will be just fine.
[00:41:50] [S4] And things won't really break under pressure because, well, there's just not a lot of it just here.
[00:41:56] [S4] It's when you build a full size application that has hundreds or maybe even thousands of components, that's where the size clearly comes into play.
[00:42:05] [S4] And all these tricks start to matter.
[00:42:10] [S2] And there used to be something called the Real World app, which was kind of like a clone of Medium, the blogging platform.
[00:42:18] [S2] So that's one that used to be really popular to be built in every framework.
[00:42:21] [S2] And then there was like to do MVC.
[00:42:24] [S2] And now we have the movie app is becoming a big one.
[00:42:27] [S2] This is always a problem.
[00:42:29] [S2] How do we actually find something that can show off the capabilities of each while also finding the pain points?
[00:42:38] [S2] I feel like benchmarking is good for finding out where they break down, but then just building some sort of like usable app that has users is a good kind of exercise for a developer to go through.
[00:42:51] [S2] So they have to go through all the different pieces of the framework.
[00:42:54] [S2] to make that happen.
[00:42:55] [S2] So, yeah, does that kind of answer your question, Jen?
[00:42:59] [S4] Let me just add something to it, sort of jumping from a job, is I think something like ToDoMVC is great to discover what the developer experience is for the developer.
[00:43:10] [S4] It might not be necessarily the best thing to discover when the framework will break under load, but it certainly is great as a developer to learn about stuff.
[00:43:21] [S11] I'm thinking, because of course I'm learning now I'm basing everything on data infrastructure and learning that from scratch.
[00:43:29] [S11] So I think something that I don't know if these two concepts go together, there are
[00:43:37] [S13] Datasets
[00:43:38] [S11] That we can use that are public that can be used to be able to put into yesterday's show was about Kafka.
[00:43:46] [S11] Is there something like that that could be used to test frameworks?
[00:43:50] [S11] Or is that like putting two ideas that don't go together?
[00:43:56] [S4] I think it's not about the amount of data the framework has to show.
[00:43:59] [S4] It's about the amount of code that's associated with that application, right?
[00:44:03] [S4] So you need to get a application that's complicated enough that it has sufficient amount of code, sufficient number of different developers who went through it and refactored the code in different ways.
[00:44:14] [S4] And of course, whenever you do refactoring, you always do it 80% of the way, right?
[00:44:17] [S4] And the last 20% is left the other way.
[00:44:20] [S4] It's only then where I think you discover how these things actually scale.
[00:44:27] [S11] That makes sense.
[00:44:27] [S11] Thank you.
[00:44:33] [S6] Actually, this this reminds me of another problem that we are seeing in a lot of enterprise e-commerce and other other kinds of websites that our teams are building.
[00:44:47] [S6] Which is that you build a a pretty decent website with any, framework.
[00:44:52] [S6] It could be Next.js, Next, or any other framework.
[00:44:56] [S6] And then what happens is when it's deployed to production, there's a huge amount of mock tech, like Google and Analytics, bot scripts, hot jar, other kinds of services, scripts that are added to the page.
[00:45:12] [S6] And that is actually where the majority of the of the JavaScript is coming from.
[00:45:22] [S6] So Misco mentioned worker dollar, like some something similar to server dollar primitive that that exists in quick now.
[00:45:34] [S6] Is that, I know that this party town framework that exists Um, but the last time we tried to use it, it's like, it's, it's, it's, it requires a lot of manual work.
[00:45:50] [S6] So, uh, are you working on something that, that would make that manual work easier or, reduced amount of manual work required to move that into a worker.
[00:46:03] [S2] Partytown better framework, yeah?
[00:46:07] [S4] Yeah, Partytown is definitely the answer I would give here for third party code.
[00:46:14] [S4] You're right, it is not as streamlined as we would like it to be.
[00:46:18] [S4] It is a hard problem, right?
[00:46:19] [S4] You can't just take code and just run it in the web worker and expect it to just kind of work out of the box.
[00:46:24] [S4] So there's lots of hoops and complications there.
[00:46:28] [S4] But yeah, it's the best we have so far in this particular department.
[00:46:31] [S4] If you as you correctly observed, when you build large scale application, third party code is a huge part of it.
[00:46:41] [S4] And I think Google reports that on average websites have something like 21 different third party domains for script tags.
[00:46:48] [S4] on their on their page.
[00:46:49] [S4] And that's a lot, right?
[00:46:50] [S4] And so figuring out how to make sure that the the third party scripts can be better about the way they run is something that certainly would help.
[00:47:00] [S4] And so PartyTime is the way to do it.
[00:47:02] [S4] Actually, I've kind of come around in a particular point of view now.
[00:47:05] [S4] And I think many of these third party scripts could be written in quick.
[00:47:11] [S4] And I think they would perform better.
[00:47:13] [S4] Because if you think about it, what all these third party scripts do on initialization is they just run tons of code that like registers listeners and sets this thing up and the other thing, etc..
[00:47:23] [S4] And many of these things could be simplified if they just weren't there.
[00:47:29] [S4] So the initialization, the reasonability of the system is kind of what you would be looking for.
[00:47:36] [S4] And if you could do that for third party code, I think you would gain a lot of benefits.
[00:47:40] [S4] But that's kind of down the line, right?
[00:47:41] [S4] Like immediately, I think Bardytown is the only really option that's available to us.
[00:47:47] [S2] And we have a question from the audience.
[00:47:49] [S2] Will worker dollar sign make most third party code?
[00:47:53] [S2] That's not supported by Partytown finally work?
[00:47:57] [S4] I think those are two separate things.
[00:47:59] [S4] Like worker dollar sign would be like the code that you have written so that you want to run it on a web worker.
[00:48:05] [S4] Partytown is really for code that somebody else has written, and you want to make it run in the web worker.
[00:48:11] [S4] So it's a very different kind of use case.
[00:48:13] [S4] I don't see them as overlapping.
[00:48:19] [S2] Okay, gotcha.
[00:48:23] [S2] Dev, welcome to the stage.
[00:48:27] [S14] Hello, hello.
[00:48:29] [S14] I can go next, but Ellery has his hand up, so let me.
[00:48:32] [S2] Yep, sounds good.
[00:48:32] [S2] Let's do that.
[00:48:35] [S10] Cool.
[00:48:35] [S10] While we're talking about Partytown, I just want to ask, have you had any large scale customers implement Partytown?
[00:48:42] [S10] I know it's still a beta product.
[00:48:44] [S10] In my experience with it, I found that it makes simple things faster and complicated things extremely painful.
[00:48:52] [S10] If you have a couple of marketing scripts, it probably works well.
[00:48:54] [S10] But for large enterprise accounts that have 20, 30 distinct marketing scripts, things that want to write directly to the data layer that are third place scripts, and now you have to intercept that and glue things together.
[00:49:06] [S10] It was pretty tedious to get things going.
[00:49:09] [S10] So just curious, if there's any plans to expand that, include support for more third parties, and maybe see it in a live production site that has a bunch of Martex scripts running on it.
[00:49:21] [S4] Yeah, so the hard part about Partytown is that you're essentially emulating the browser in a web worker.
[00:49:27] [S4] The web worker doesn't have all the browser APIs like DOM, etc..
[00:49:31] [S4] And so you have to do an emulation.
[00:49:33] [S4] And the thing with emulators is that it's easy to get 80% And it's in every additional percentage point that you want to get in terms of like the accuracy becomes more and more difficult.
[00:49:45] [S4] And so the thing with Partytown is that it is it is very, very difficult to get I mean, it's possible, but it's just the amount of time you have to put into it is pretty high.
[00:49:56] [S4] And currently, we're just as a company builder has decided to put its resources behind quick right now, because that's a direct benefit to the customers in terms of the code that they own.
[00:50:11] [S4] And so Partytown is not getting as much love as it would deserve.
[00:50:15] [S4] I still think it's a pretty cool technology that that can go places.
[00:50:20] [S4] But it is a hard thing because when things don't work, as you point out, the issue you have is that you have now a third party minified script that is throwing some exception.
[00:50:31] [S4] And good luck figuring out in the minified code base that is not even yours, what's going on, why this exception is being thrown, what particular bits have you not emulated correctly enough that the third party code is kind of being confused about it.
[00:50:46] [S4] I think that the way to get around this particular problem is to almost like create a certification program for third party providers.
[00:50:55] [S4] And basically say like, hey, wouldn't it be great if the third party provider would test their own code with Partytown, verify that it works, and there were no surprises, and there are either fix it in their side or fix it in Partytown, while it's not minified.
[00:51:10] [S4] And then that would become almost like a value add, right?
[00:51:14] [S4] And you could just brag on yourself, like, hey, our our third party script runs in Party Town.
[00:51:18] [S4] So like, we we made sure that the setup is easy, etc..
[00:51:22] [S4] So I'm chatting actually with folks at Google about this to see if we could have some kind of a certification program like that.
[00:51:28] [S4] We haven't gotten very far.
[00:51:29] [S4] But I think that's the way to solve this.
[00:51:32] [S4] Because solving it by just trying to brutally go through every single discrepancy in behavior, it just puts a huge amount of resource drain on us.
[00:51:44] [S4] And it's not a simple, straightforward thing to do.
[00:51:48] [S10] Yeah, I was almost questioning at one point whether it was the right solution, just taking compute, moving it to worker threads versus something like Zeras or server side tagging, which I think Google Analytics supports.
[00:52:02] [S10] I think that's probably where the future is in my mind.
[00:52:05] [S10] I have one, you know, Martex script in my site that publishes events with enough data for a wide array of other third party scripts to consume from, and it just fans out in the server to everyone.
[00:52:19] [S4] Yeah, absolutely.
[00:52:20] [S4] There's there's definitely other ways of solving this problem.
[00:52:23] [S4] I think Partython just takes it from the point of view, like, given the the world as it is today with these things, these third party scripts as they are today, what's the best we can do?
[00:52:34] [S4] And so the Partyton is the answer to that.
[00:52:36] [S4] But if you're willing to change what the status quo is and the world, you know, like that we just move code to the server, yeah, absolutely, that would be a better solution to the problem, right?
[00:52:45] [S4] But we're not there yet as an ecosystem.
[00:52:53] [S15] I don't know.
[00:52:53] [S2] I don't know if anyone here watches the show Party Down.
[00:52:56] [S2] Every time now I hear Party Town.
[00:52:58] [S2] It kind of makes me think of Party Down.
[00:53:00] [S2] Very good show.
[00:53:01] [S2] People haven't checked it out.
[00:53:03] [S4] I've never heard of it.
[00:53:03] [S4] I'll check it out.
[00:53:05] [S2] Yeah.
[00:53:05] [S2] it just had a reboot actually.
[00:53:08] [S2] Dev, do you want to hop in here?
[00:53:11] [S14] Yeah, how's it going?
[00:53:12] [S14] So I had a question about QUIC.
[00:53:15] [S14] Mishko, you started this space by saying like saying that QUIC is the performant framework, and you achieve the initial bundle size.
[00:53:24] [S14] You reduce the bundle size by basically lazy loading the interactive bits, and they're loaded once the user actually interacts with them.
[00:53:34] [S14] So once they are loaded, the interactive bits, there is another dimension of performance, which is when I click a button or when I open a dialog, how quickly are those how quickly do those things appear on the screen?
[00:53:47] [S14] How much work does the CPU have to do to get there?
[00:53:50] [S14] Or when new data is fetched from the server, how quickly is that displayed on the UI?
[00:53:55] [S14] So I know QUIC has a virtual DOM but QUIC also has signals.
[00:53:59] [S14] So I was hoping to get some information about what does that interactivity look like?
[00:54:05] [S14] How does it work with signals and VDOM?
[00:54:09] [S4] Yeah, good question.
[00:54:10] [S4] Yeah, so definitely there are two different dimensions here.
[00:54:13] [S4] There's the dimension of how fast can we make the page interactive?
[00:54:16] [S4] And a second dimension is, once the page is interactive, how fast can we update?
[00:54:21] [S4] So in order to get the page interactive on your site as soon as possible, Qwik has to be super aggressive about lazy execution of the code.
[00:54:33] [S4] And it turns out that if you want to be aggressive about lazy execution of the code, solutions that are coarse grained reactive, like for example, React or Angular, right?
[00:54:44] [S4] When you change something in React or Angular, you are changing a state and the whole thing that propagates.
[00:54:49] [S4] A lot of code executes.
[00:54:51] [S4] And so things that are course grade reactive do not play well with resumable systems, because what's happening is that even if you can get the page up and running quickly because you delayed executed the code, the first interaction will likely execute 80% of your application code.
[00:55:11] [S4] And that's kind of the problem that you're trying to avoid.
[00:55:14] [S4] So QUIC, for that reason, is fine grained reactive.
[00:55:18] [S4] So that when things update, we want to be surgical about what we update.
[00:55:23] [S4] So we do use VDOM sometimes, but there should be a big caveat placed in there.
[00:55:30] [S4] Because the way React uses VDOM is that it starts at a particular component.
[00:55:36] [S4] And by default, all child components get rendered underneath it.
[00:55:40] [S4] Now there's ways to kind of short circuit that and make it render less.
[00:55:45] [S4] But the default behavior is that you start at the root and you kind of rerender everything below it.
[00:55:51] [S4] The other thing that happens oftentimes in these systems is that because you put shared state in a common ancestor, oftentimes, your root component or somewhere close to the root component is where all of your state is.
[00:56:04] [S4] So any modifications of the state tend to rerender this whole tree for you.
[00:56:10] [S4] And so that has a negative impact on performance.
[00:56:13] [S4] Rather, the main issue there is that, yes, it's slower.
[00:56:18] [S4] But the thing that we really care about is the fact that it forces you to download and execute a whole bunch of code that you otherwise wouldn't have to.
[00:56:25] [S4] And so while QUIC does have VDOM, it is very good at basically updating just the component itself.
[00:56:33] [S4] So if you have a situation where you have a let's say you have three components, a root component and a child component that has a buy button and another child component that has the shopping cart, right?
[00:56:43] [S4] And so the shared common ancestor is the root component.
[00:56:47] [S4] And then if you push the buy button, you're updating state inside of the root component, which then causes the shopping cart to update a common setup.
[00:56:55] [S4] So in in default behaving systems, the way this would work is that you would rerender everything from a root component.
[00:57:01] [S4] In QUIC, what would happen is that because it's a fine grained reactive, the clicking of the buy button would then directly notify the shopping cart and would completely bypass the other components.
[00:57:13] [S4] They wouldn't even have to download.
[00:57:14] [S4] So even though QUIC, in that sense, has a VDOM, it it really prunes the tree automatically for you.
[00:57:24] [S4] And it prunes it quite aggressively.
[00:57:26] [S4] But what we've been doing lately in QUIC with signals is actually taking it into a whole another level, which is that if you have a component that doesn't have a structural change, meaning like if you have a component that has an if statement in there, or show A or show B, depending on some flag, that's a structural change to the DOM.
[00:57:44] [S4] If your component doesn't have a structural change to DOM, it only has updating a binding, like current price or quantity or the total In that particular case, we don't even have to download or execute the VDOM.
[00:57:56] [S4] So if the change isn't structural, then the whole VDOM doesn't even come into play.
[00:58:00] [S4] And we don't even have to download the component or execute it or anything like that, we can just directly go and update the DOM.
[00:58:08] [S4] So I would say that, you know, quick, in terms of performance after you initially load the page, is going to be somewhere between React and SolidJS.
[00:58:21] [S4] SolidJS being the undisputed king in terms of how fast you can go.
[00:58:27] [S4] And then React is super popular, but it kind of rerenders I would say like too much by default.
[00:58:34] [S4] So that's a pretty wide band, but I would say we're probably closer to the solid side than we are in terms of the quick side, because we have signals and we have this VDOM pruning that happens pretty aggressively.
[00:58:47] [S4] And so for the most operations that you will see, you will actually not even bring VDOM into into play.
[00:58:54] [S4] But having said that, I want to point out that there's a lot of websites out there written in React.
[00:59:00] [S4] And for the most part, once the application is up and running, they're plenty fast.
[00:59:06] [S4] And so, well, yeah, it's important to focus on runtime performance.
[00:59:11] [S4] I'm going to argue that it's a bit of a red herring in a sense that just about any technology you choose, usually you end up with a site that's plenty fast for you once it's up.
[00:59:22] [S4] and running, right?
[00:59:23] [S4] It's the getting it up and running part that I think we have a problem as an industry.
[00:59:28] [S4] And so that's the part that really Qwik wants to focus on.
[00:59:31] [S4] But having said that, right, again, like, we're going to be still a lot faster than Qwik.
[00:59:35] [S4] We're going be probably within reaching distance of what solid does.
[00:59:43] [S14] Yeah, that's great.
[00:59:43] [S14] I have just one quick follow up.
[00:59:45] [S14] So it's great that you mentioned that the runtime performance is mostly a red herring.
[00:59:51] [S14] Because I think a lot of the discussion around signals has mostly been about the DX.
[00:59:56] [S14] So just where do you stand on, do you think there are DX wins with signals, just apart from the performance?
[01:00:06] [S4] Yeah, absolutely.
[01:00:06] [S4] I love the DX of signals.
[01:00:09] [S4] To us, the real win of signals is not necessarily the performance.
[01:00:14] [S4] We although that's nice.
[01:00:15] [S4] But really, it's the fact that signals allow us to not execute a whole bunch of code.
[01:00:21] [S4] And the not executing code, certainly it's a performance thing that makes the code run faster.
[01:00:27] [S4] But the real benefit of that is that because I don't have to execute that code, QUIC doesn't have them download the code.
[01:00:34] [S4] And so the win to us with signals is not necessarily that that they run faster.
[01:00:38] [S4] It's that they allow you to not execute and therefore not download a whole bunch of unnecessary code.
[01:00:44] [S4] And so you end up with a smaller amount of code that has to get shipped to the browser.
[01:00:51] [S14] Got it.
[01:00:52] [S14] Thank you.
[01:01:01] [S2] Scott, we're at the hour mark.
[01:01:02] [S2] You want to do a quick station break?
[01:01:05] [S2] And then Mishko, how long do you have to go for?
[01:01:09] [S4] I think I am I am free after the Cool.
[01:01:14] [S2] Well, I'm kind of just seeing how people have questions.
[01:01:18] [S4] Great, awesome.
[01:01:18] [S4] Can we mean, half an hour for the scheduled one, which was 130, right?
[01:01:21] [S4] So like, yeah, I have like an hour.
[01:01:24] [S4] Yeah.
[01:01:24] [S4] So I'm good.
[01:01:26] [S2] Okay, cool.
[01:01:27] [S3] Nice.
[01:01:28] [S3] All right.
[01:01:29] [S3] Thank you so much.
[01:01:30] [S3] Appreciate everybody coming up here.
[01:01:32] [S3] talking.
[01:01:33] [S3] Mishko, thanks for joining us today.
[01:01:34] [S3] It's been fantastic so far and I'm sure it will continue to be that.
[01:01:38] [S3] Oh man, this has been some great conversation.
[01:01:40] [S3] Just sitting here listening to everybody's been so fulfilling.
[01:01:43] [S3] So, thank you for everybody.
[01:01:45] [S3] Uh by the way, uh anybody that's up here that's come up here and maybe they're not on the stage anymore.
[01:01:50] [S3] Um either way, if you've gotten value from them, please click on their face there.
[01:01:54] [S3] Be sure to follow them because I guarantee you if you've gotten value from them here, then you will probably get value from them in other places.
[01:02:01] [S3] So be sure to do that.
[01:02:02] [S3] And hey, you know what?
[01:02:03] [S3] If you want to give JavaScript GM a little follow, we wouldn't mind that either.
[01:02:07] [S3] By the way, if you're not already part of our JavaScript GM newsletter and receiving that in your inbox and getting all that awesome value that Anthony writes up every week.
[01:02:15] [S3] You're missing out.
[01:02:16] [S3] You need to go and subscribe to that guy and get that coming to your inbox so that you can keep up with the things going on in the.
[01:02:24] [S3] world without having to, and the world of web dev and JavaScript that is, without having to really search around too much, we kind of send it right to you.
[01:02:33] [S3] So not just that, it's usually things that we will be talking about in our Wednesday talk.
[01:02:38] [S3] So feel free to go there and download or subscribe and we can go from there.
[01:02:46] [S3] Anyway, thank you all so much.
[01:02:48] [S3] Greatly appreciate it.
[01:02:49] [S3] Remember this as well.
[01:02:51] [S3] If you are a beginner or you're an advanced lifelong learner up here, it doesn't matter.
[01:02:56] [S3] We love to hear from everybody.
[01:02:57] [S3] So feel free to request to come up and we'll bring you up on stage.
[01:03:01] [S3] You can ask a question, comment, concern, fact, statement, opinion, whatever.
[01:03:06] [S3] We'd love to hear from you.
[01:03:08] [S3] All right.
[01:03:09] [S3] Thank you all so much.
[01:03:10] [S3] And back to you, Anthony.
[01:03:13] [S2] Yeah, and if people are interested in quick, you know, these kind of frameworks.
[01:03:17] [S2] And that's really the type of stuff we cover in the newsletter of links to a bunch of Mishko's blog posts and podcast interviews and things like that.
[01:03:28] [S2] We also give you a rundown of the weekly podcast episodes.
[01:03:34] [S5] So I think we kind
[01:03:36] [S3] Of dropped out and then
[01:03:37] [S5] I.
[01:03:37] [S5] Yeah, so I invited me back up.
[01:03:39] [S5] Back up right now.
[01:03:42] [S2] Cool.
[01:03:43] [S2] Dev, I'm curious.
[01:03:44] [S2] Oh, wait, Dev actually is back down as a listener as well.
[01:03:47] [S2] So Raiz, what's up?
[01:03:50] [S6] Yeah, I was just just going to bring it to to build an IO and just for context, as I mentioned, I'm the product manager for GeoSites, which is a platform for building and running JavaScript websites.
[01:04:07] [S6] And what of the things we are actually considering is we have an old framework called React Storefront.
[01:04:17] [S6] And it was an e-commerce web development framework.
[01:04:21] [S6] from from a couple of years ago that hasn't been maintained yet.
[01:04:25] [S6] And we are we are considering writing that in in QUIC, to solve these kind of performance problems that are so common, especially in e-commerce websites, large e-commerce websites, and then integrating it with something like something like Builder.io.
[01:04:43] [S6] So I'm just wondering, like how do you do you have a project projects like that already, you know, in your that you are aware of that maybe we can learn something from or would you be like, how does how does this sound to you?
[01:04:59] [S6] Would you be interested in collaborating if I plug myself in?
[01:05:06] [S4] Yeah, absolutely.
[01:05:07] [S4] Actually, we do have something similar already.
[01:05:09] [S4] So first of all, we have a Discord channel.
[01:05:12] [S4] And people who are actually building website, we kind of have that have reached out to us and they want to collaborate like that.
[01:05:18] [S4] We actually have private channels where we can help them out, etc..
[01:05:21] [S4] There is a company that actually is selling sporting goods, and I can't remember the name of it right now.
[01:05:26] [S4] And they're doing something very similar, as you're pointing it out.
[01:05:30] [S4] And they're rebuilding their e-commerce website in in Quik.
[01:05:35] [S4] And so they're having a pretty good experience.
[01:05:37] [S4] And when things arise, they reach out to us and we help them out.
[01:05:41] [S4] So yeah, reach out to me on Discord and I'm happy to set something up.
[01:05:45] [S6] Excellent.
[01:05:45] [S6] Thank you.
[01:05:51] [S2] Yeah, do you want to talk about the kind of quick community at all?
[01:05:57] [S4] Yeah, we can talk about the community.
[01:05:58] [S4] Yeah, so very proud of the community.
[01:06:01] [S4] They are I think we're now the Disco channel is about 5000 strong.
[01:06:09] [S4] We have what we call quick heroes, which are a bunch of people who have been with us for a while.
[01:06:14] [S4] And they're super helpful on going around and answering other people's questions.
[01:06:18] [S4] and providing feedback and building cool things.
[01:06:21] [S4] So yeah, I think Discord is a is a good place to start.
[01:06:24] [S4] And as a beginner, you can get lots of questions answered over there for us.
[01:06:29] [S4] And yeah, we're trying to make it easier every day.
[01:06:33] [S4] Right now, we're focusing, as I said, for documentation to get it before 1.0 and kind of a revamp on everything.
[01:06:40] [S4] But yeah.
[01:06:44] [S2] Sweet.
[01:06:46] [S2] Open floor right now to any of the speakers on the stage.
[01:06:49] [S2] Everyone has questions.
[01:06:50] [S2] Feel free.
[01:06:51] [S2] It could be about quick or anything else.
[01:06:59] [S2] And if there's anything else you want to speak about, Misha, we haven't talked about yet, or things that are coming up, you want people to know about, feel free to do that as well.
[01:07:09] [S4] You know, I can, if people don't have questions, I can definitely talk about something.
[01:07:13] [S4] One thing I find interesting, I kind of touched on it earlier, is that when we talk to other folks who are building websites using Next.js, etc., there's often like this vocabulary mismatch.
[01:07:26] [S4] Like for example, we have these dollar signs everywhere, right?
[01:07:29] [S4] And so when we first try to explain it to people, they're like, well, I don't have dollar signs or anything equivalent like that inside of my meta framework, like, why do you need it?
[01:07:38] [S4] Like, it's kind of hard to wrap my head around it, because I was able to build sites without it.
[01:07:43] [S4] So why is this all of a sudden necessary?
[01:07:46] [S4] And, you know, you can build web websites without it, right?
[01:07:50] [S4] Like we've been doing it for a while.
[01:07:51] [S4] But this dollar signs gives you a particular value, which is like, hey, you need to get entry points into your system.
[01:07:58] [S4] And then people, of course, are like, well, what do you mean by entry points?
[01:08:00] [S4] Like, again, it's not some something that I can relate to because we don't really have the equivalent in it.
[01:08:06] [S4] And so we're just kind of constantly discovering that it requires a bit of a vocabulary shift.
[01:08:12] [S4] So for example, why entry points, right?
[01:08:15] [S4] Well, if you want to be resumable or rather let's back up a second.
[01:08:19] [S4] What's an entry point for a typical application?
[01:08:21] [S4] Well, there is a if you have a React application, there is a main bundle somewhere that you load.
[01:08:26] [S4] And that main bundle has a function that essentially calls render function.
[01:08:33] [S4] I forget the latest API in React, but there's a render that kind of gets invoked.
[01:08:38] [S4] And if you think about it, that's the only entry point that's available in your system.
[01:08:42] [S4] I mean, yes, if you have lazy loading, then there's other entry points.
[01:08:46] [S4] But for the most part, the way React gets a hold of all of your application is that it starts at the root and then traverses all the components and gets hold of the listeners, etc.
[01:08:57] [S4] Actually, it's not true just for React.
[01:09:00] [S4] It's true for any existing system, right?
[01:09:02] [S4] Whether it's Angular, Vue, Solid, etc..
[01:09:05] [S4] The way these systems get a hold of everything is that they start at the root and they traverse the components.
[01:09:13] [S4] And so if you want to have a resumable system, you realize like, well, my entry point cannot be the root component Because if it's the root component, then the only option I have is, well, start at the root component and traverse all the children and look for everything.
[01:09:30] [S4] And so you need a way of saying, like, I would like to enter the system in other places, not just the root location.
[01:09:36] [S4] And so QUIC has needs to solve the problem of like, how do I create a system where there are lots and lots of entry points.
[01:09:43] [S4] And as a matter of fact, the more the better.
[01:09:45] [S4] And this is where the dollar sign comes in, right?
[01:09:47] [S4] Really, what a dollar sign is is a way to get more entries into the system so that when you render a simple counter with a plus button and a minus button, clicking on plus is a different entry into the system than clicking on the minus.
[01:10:04] [S4] Because one runs code to increment, one runs code to decrement.
[01:10:09] [S4] And so you don't necessarily need to have both of them at the present at the same time.
[01:10:14] [S4] And so we find that it's really hard to explain to people why we are doing this, why you need this.
[01:10:22] [S4] But once you understand it, it just come, you know, you you get new vocabulary that kind of is important.
[01:10:29] [S4] And then with it come secondary problems like, hey, you know, as was kind of pointed out, like, we now need to lazy load things.
[01:10:36] [S4] Well, how do we make sure that as a developer, you don't have to worry about lazy loading.
[01:10:40] [S4] How do we make sure that you prefetch everything and so on?
[01:10:43] [S4] And so there's a lot of concepts that just aren't available in in the other frameworks.
[01:10:48] [S4] And that's what makes it kind of difficult for people to rub their head around it at the beginning.
[01:10:55] [S2] Yeah, I find that there's always a vocabulary gap once you start crossing over, even if frameworks are ultimately building the same thing at the end of the day website.
[01:11:07] [S2] The way they get there can be very different and involve different mental models and terminology.
[01:11:13] [S2] You actually wrote a blog post recently, Resumability from the Ground up.
[01:11:19] [S2] How would you do you want to kind of summarize what that blog post goes to?
[01:11:22] [S2] I feel like this is another word that is like a vocabulary gap with quick.
[01:11:27] [S4] Yeah, so the I recently been writing a lot of these from Ground Up posts where I basically try to solve a particular problem and kind of take you, the reader, through these steps as in like, well, let's say we wanted to do this.
[01:11:41] [S4] What kind of issues
[01:11:42] [S2] I've really liked them.
[01:11:43] [S2] There's been really good blogging on Builder.
[01:11:45] [S5] Oh, thank you.
[01:11:46] [S5] Thank you.
[01:11:46] [S5] I appreciate that.
[01:11:48] [S4] So the idea of resumability is, you know, what if you didn't want to execute any code at the beginning, right, of your application?
[01:11:55] [S4] What kind of steps would you have to go through?
[01:11:58] [S4] And so what that blog post essentially goes through is like, well, the first thing you need to do is like, okay, so you click on a button, and the button is a listener somewhere, right?
[01:12:06] [S4] And that listener is usually buried somewhere deep inside of your JSX.
[01:12:10] [S4] How do you get a hold of it?
[01:12:11] [S4] How do I get a hold of these listeners that's deep down?
[01:12:15] [S4] And so let's say you solve that problem.
[01:12:17] [S4] So the next problem you have is like, great.
[01:12:19] [S4] So now you're executing this listener, but this listener has no state.
[01:12:23] [S4] It lost all of the information.
[01:12:25] [S4] It's just a code without the state of the system.
[01:12:28] [S4] How does it know what the current value of the counter is?
[01:12:30] [S4] Do I add 1 to 0 or 10 or 100?
[01:12:33] [S4] What's the current state?
[01:12:35] [S4] And so you have to solve that particular problem.
[01:12:37] [S4] And so you just kind of go through all of these pieces and you kind of realize like, hey, you know, all of these things are things that are that need to be solved, but there's no equivalent in other frameworks because, well, other frameworks solve this problem by hydration.
[01:12:51] [S4] And hydration just means just re-executing everything from the beginning.
[01:12:55] [S4] There is no reasonable ability.
[01:12:57] [S4] So yeah, there's a lot of vocabulary that has to be kind of learned to get there.
[01:13:05] [S2] Very cool.
[01:13:06] [S2] I've heard you give that pitch quite a few times now, both interviewing you and listening to other things.
[01:13:12] [S2] And I think it makes sense at this point.
[01:13:14] [S2] Took a while, but it seems to be.
[01:13:16] [S5] Yeah.
[01:13:16] [S4] Also, sorry, I'm going to go on tangent here.
[01:13:18] [S4] I also find it interesting that a lot of people like confuse resumability with like delayed hydration And the two are really different.
[01:13:31] [S4] Because in the case of a hydration, you're still doing all the work.
[01:13:35] [S4] You're just arguing about when the work gets done.
[01:13:37] [S4] Is it now or a little bit later, right?
[01:13:40] [S4] Whereas with resume ability, like that work fundamentally isn't there.
[01:13:44] [S4] Like there is no hydration, right?
[01:13:47] [S4] And so like if you if we talk about hydration, like we need to talk about how do we define hydration?
[01:13:52] [S4] And a lot of people tend to define it as just make the page interactive.
[01:13:56] [S4] But I think that kind of misses the point.
[01:13:58] [S4] The real point of hydration is for the framework to recover its internal state.
[01:14:03] [S4] And what I mean by that is for the framework, needs to know, where are the component boundaries?
[01:14:08] [S4] Where are the listeners?
[01:14:09] [S4] What is the state of the component?
[01:14:10] [S4] If this state changes, what other components do I have to rerender?
[01:14:15] [S4] This is really what's being rebuilt as part of hydration.
[01:14:19] [S4] And that's the the hard part.
[01:14:21] [S4] The listener part is relatively easy to solve and also to kind of get around, right?
[01:14:28] [S4] Like, yes, on the end of the day, we're doing all this work to make the page interactive.
[01:14:33] [S4] But really, hydration is about recovering that internal state for the framework.
[01:14:38] [S4] And so the place where quick, I think, is unique is that the quick doesn't go about it this way.
[01:14:45] [S4] Quick basically said, look, I had the state when I did server side rendering.
[01:14:50] [S4] And therefore, I just need to somehow move that state from the server to the client.
[01:14:54] [S4] So if I can serialize my state in such a way into HTML that I don't need to rerun any of the components, then I can just literally resume where I left off.
[01:15:04] [S4] And if you think about it, existing applications already have that.
[01:15:07] [S4] If you look at Next.js, Next.js takes the state of the application and serializes it into the underscore next underscore app or something like that.
[01:15:16] [S4] I forget the name of the data that gets serialized inside of the HTML, right?
[01:15:20] [S4] That's the state of the application so that your application can just continue where it left over, meaning it doesn't have to re execute fetching of the data and re execute anything like that.
[01:15:34] [S4] What's missing is to do the same exact thing but for the framework, right?
[01:15:39] [S4] And that's the hard part.
[01:15:40] [S4] It's like, you cannot reach into your rendering framework and be like, give me your state so that I can serialize it in such a way so that when you wake up, you can just continue where you left off.
[01:15:52] [S4] And that's the hard part.
[01:15:52] [S4] That's the thing that I think is is unique.
[01:15:56] [S4] And it requires kind of getting your head around it and learning about it.
[01:16:01] [S2] Yeah, that was the very big galaxy brain idea for me.
[01:16:04] [S2] The first time you explained this to me, the state of your app and the state of the frameworks, it had never even occurred to me to think about that before, because I'm someone who has used so many frameworks and for the most part can get them to work and do what I need them to do without needing to know too much of the internals.
[01:16:20] [S2] But eventually, you have to actually learn that.
[01:16:25] [S4] If you look at two different kinds of frameworks, like let's say you're in React and then you want to go to Svelte, right?
[01:16:30] [S4] They fundamentally work very similarly.
[01:16:32] [S4] And so while you might need to learn new concepts, it's relatively, I would say, straightforward because these concepts map one to one.
[01:16:40] [S4] Like, how do I get a hide or show a component?
[01:16:44] [S4] Well, in React, you use this.
[01:16:46] [S4] In Svelte, you do this.
[01:16:47] [S4] And so you have like this mental mapping between the two things, right, that exist.
[01:16:52] [S4] Whereas, you know, if you come to a it from too quick, sure, we have the mental mapping of like, how do you hide something?
[01:16:59] [S4] How do you show something?
[01:17:00] [S4] But then when you start talking about reasonability, it's like, I don't have an equivalent thing on the other side.
[01:17:06] [S4] And so like, what are you talking about?
[01:17:07] [S4] I'm kind of confused, right?
[01:17:09] [S4] And this is the part that that is hard.
[01:17:11] [S4] And and so what typically happens is people say, well, I don't understand what you mean by resumability, but I have this other thing called hydration.
[01:17:18] [S4] So I think you just mean hydration, right?
[01:17:20] [S4] And so they desperately try to bring you back into this thing.
[01:17:24] [S4] And then you're like, well, no, it's not hydration.
[01:17:27] [S4] Because what hydration does is essentially booting up your framework.
[01:17:33] [S4] It's executing all the code so that you can boot up your system.
[01:17:37] [S4] And that bit is the bit that's going to skip.
[01:17:40] [S5] But I think we do this.
[01:17:42] [S2] We do this in tech when we compare things, which is we can compare two things because they're trying to solve the same problem.
[01:17:48] [S2] And we can compare two things because they're actually similar to each other.
[01:17:51] [S2] This happened with Redwood and Blitz.
[01:17:53] [S2] Everyone would always bundle them together and be like, yeah, there's two full stack frameworks with React.
[01:17:58] [S2] And they're totally different how they work worked architecturally internally, but they always got kind of bundled together.
[01:18:04] [S2] And so it's like, you hear this one thing, it triggers this other idea in your brain.
[01:18:07] [S2] And so, but you have to actually think, wait, these are not the same thing.
[01:18:11] [S2] They're two different things.
[01:18:11] [S2] So what's the difference?
[01:18:13] [S4] Yes, yes, that's right.
[01:18:16] [S2] Cool.
[01:18:17] [S2] We got someone else hop up here.
[01:18:19] [S5] Yep.
[01:18:20] [S5] Yep.
[01:18:21] [S16] Hi, everyone.
[01:18:22] [S16] Hi, Michko.
[01:18:23] [S16] I've had asked questions a couple of times before from Michiko about the quick.
[01:18:27] [S16] So I have a new one.
[01:18:29] [S16] In terms of the resumability, I was wondering that since you're serializing the closure for that matter, is there any specific limitation on that serialization?
[01:18:42] [S16] And like the, do you care about the data types that are available in the closure that's supposed to be, uh, serialized and be used again once the app supposed to resume from that entry point.
[01:18:55] [S16] And the other question would be, is there any process like a garbage collection or anything like that running in the quick to sort of unhook the closures that are not being used anymore?
[01:19:11] [S4] Oh, good questions.
[01:19:14] [S4] So the short answer is that the closure can close over anything that the systems know how to serialize.
[01:19:20] [S4] So obviously, all the JSON type, we know how to serialize, but we can also serialize promises, maps, sets, and of course, other closures.
[01:19:29] [S4] So anything that serializes serializable is something that closure can close over, and it will just work.
[01:19:35] [S4] And so this is nice because closures can close over other closures, which then in turn can close over other things, and so on.
[01:19:41] [S4] The thing that's hard about serializing closure is that you need to separate out the the JavaScript, the behavior from the state.
[01:19:50] [S4] And so these two pieces of data need to be shipped into separate locations One goes into the bundler, and the other one gets placed inside of your kind of the JSON serialized state object.
[01:20:05] [S4] And then the system then needs to put everything back together.
[01:20:08] [S4] And what gets even trippier is that let's say you're using server dollar sign.
[01:20:13] [S4] Well, in that case, you have a you know what your code is, right?
[01:20:18] [S4] That's just JavaScript that's available to you.
[01:20:20] [S4] And then you know what variables you closed over.
[01:20:23] [S4] But now you have to ship that information to the server.
[01:20:26] [S4] Except server, you know, client is running ESM, but the server is running CJS.
[01:20:33] [S4] So you can't just like use the same exact code that the client had, because that's not going to work.
[01:20:38] [S4] So you also have to do a little bit of a mapping and be like, oh, right, right.
[01:20:40] [S4] So that closure is actually the equivalent CJS code over here.
[01:20:44] [S4] So let me execute that code instead.
[01:20:46] [S4] And then you have to put the data back into the closure, kind of make it work.
[01:20:49] [S4] again.
[01:20:49] [S4] So there's lots of interesting trickery that has to happen in order to make this available.
[01:20:53] [S4] But I think the payback is really, really nice.
[01:20:57] [S4] One of my favorite ways of kind of seeing how you get a payback is that you know, in most frameworks, if you say like, hey, I need to listen to a scroll let's say I need to listen to a scroll event.
[01:21:10] [S4] The idea that you could set up the listener for the scroll event on a server and then execute the scroll event on the client makes no sense.
[01:21:17] [S4] Like, what are you talking about?
[01:21:18] [S4] Of course, I have to wait until I am on the client.
[01:21:22] [S4] And only then can I actually call the add event listener to kind of set up a listener for the scrolling, right?
[01:21:28] [S4] But what this closure trick really allows you to do is to basically say, actually, no, you can on a server, before you even have a browser or DOM or anything, you can execute the equivalent of add event listener and set up say like, hey, I'm interested in listening to this thing.
[01:21:44] [S4] But then on the client, you don't actually have to do that.
[01:21:46] [S4] You can just continue running the execution of the of the listener.
[01:21:51] [S4] And so I think that's the goal, the end goal that you you're going after is that you can essentially skip all the ad event listeners that need to happen on a client.
[01:22:00] [S4] And it's interesting, because it is one of the biggest gotchas we actually found in Qwik, is that people who come to Qwik from other places, they immediately kind of gravitate to their old ways of doing things.
[01:22:13] [S4] And so if they want to set up a scroll listener, they immediately say like, okay, run code eagerly on the client so that I can execute add event listener and register the closure.
[01:22:23] [S4] And then we have to be like, no, no, no, no, you're missing the point here.
[01:22:25] [S4] You actually want to execute this code on a server and then have the closure only materialized if somebody actually does the scrolling.
[01:22:35] [S6] So in this case, is is the the compiler, I guess?
[01:22:41] [S6] Is it looking at all the event listener calls and then instructing the framework to to basically invoke them when that event happens?
[01:22:53] [S6] How does that actually work?
[01:22:55] [S5] Yeah, yeah.
[01:22:55] [S4] So this is where the QuickLoader comes in.
[01:22:57] [S4] Actually, the answer is you cannot use ad event listener.
[01:23:01] [S4] The ad event listener is kind of your enemy.
[01:23:03] [S4] And so you need to be able to design a system without it.
[01:23:06] [S4] And so the way we get around this particular problem is that the only place where the listener the ad event listener exists, is inside of a quick loader.
[01:23:15] [S4] So quick loader is this piece of code that eagerly executes at the beginning and sets up a global listeners and relies on the fact that browser events bubble.
[01:23:25] [S4] right?
[01:23:25] [S4] So if the system notices that somebody is interested in scroll events, then it kind of notifies the quick event listener, the quick loader saying like, hey, by the way, I need to know about the scroll events.
[01:23:36] [S4] And so the the quick loader sets up a global listener for all scroll events.
[01:23:40] [S4] And then when the event happens, the QuickLoader tries to figure out, so the event happened, let me go back to where the event originated from and see if I can find a special attribute that tells me which closure I have to execute.
[01:23:57] [S4] And if it finds that information, then it actually executes the closure.
[01:24:00] [S4] So the end effect is as if you executed at event listener on a server, that's kind of how it looks like to you as a developer.
[01:24:09] [S4] But of course, in practice, what it just means is that we kind of just delayed it and did it on the client.
[01:24:14] [S4] But we also did it in a way where we don't have to normally if you have 10 buttons and you set up 10 on clicks, then you have to call Adam and Listener 10 times, right?
[01:24:27] [S4] But with Quick and the Quick Loader, you only set up a single ad event listener in the root for all click based events for the system.
[01:24:38] [S6] That's very interesting.
[01:24:39] [S6] It seems like you hear about these conspiracies theories that all the technical, technological advancements are happening because, you know, some government has the alien technology hidden somewhere and they're just copying that alien technology.
[01:24:55] [S2] I was because it's zero interest rates.
[01:24:59] [S6] So, you know, it seems like you you found the perfect architecture in all of these cases and you're just, you know, checking the things off the list, like, you know, this is the way to do that.
[01:25:11] [S6] And, you know, that's, that's very inspiring.
[01:25:14] [S6] The other way, this kind of reminds me of another problem that I've been thinking about, and I don't understand this is, When you're using signals, the the rerendering happens much less because supposedly the the way the signal change is different from the way you use state changes in React.
[01:25:41] [S6] So I was just wondering, there's very similar primitives in quick as well, where you can use, there's a primitive called use store, I think, and then React has a use state.
[01:25:55] [S6] And they seem to work the same way.
[01:25:58] [S6] How is it that one of them can can result in less amount of rerendering and the other one doesn't.
[01:26:07] [S4] Yeah.
[01:26:08] [S4] So the difference is kind of subtle, but it's super important.
[01:26:12] [S4] And the difference is that if you look at it the way React does it, React is unable to observe where the state is being used.
[01:26:23] [S4] Like once you call useState, the useState returns to you a value.
[01:26:29] [S4] And the moment the React returns the value, React fails to have any form of observability into like, what are you going to do with it?
[01:26:37] [S4] Whether you throw the value away, or you pass it to a bunch of other components, or you use it internally just inside of your component, there is no way for React to know that information.
[01:26:49] [S4] That information is just forever lost.
[01:26:52] [S4] And because it's lost, the React can only do the next obvious thing, which is just rerender everything.
[01:26:59] [S4] And that's why it's coarse grain reactive.
[01:27:01] [S4] So what signals and store and store is kind of just a slightly different signal.
[01:27:08] [S4] What they allow you to do is that when you get back the the value from the used signal or used store, you don't actually get back the value directly instead you get a wrapper.
[01:27:21] [S4] And this wrapper comes either in the form of a proxy or a getter and a setter.
[01:27:25] [S4] There's a lot of different kind of variations on this particular thing.
[01:27:29] [S4] Solid.js has getters and setters.
[01:27:32] [S4] MobX has proxies.
[01:27:35] [S4] I think Vue has proxies as well.
[01:27:37] [S4] And so what these proxies allow you to do is that they basically decouple, return returning the the proxy from returning the value.
[01:27:50] [S4] So now the framework knows when you're actually getting hold of the value.
[01:27:54] [S4] So when you want to get a hold of the value, you have to either call call a getter property, or you invoke the getter or do something.
[01:28:02] [S4] And that action of something is information to the framework.
[01:28:07] [S4] And so the framework then is able to make a basically a subscription, basically make a mark that says, aha, I know that this value has been used here, here, here, and there.
[01:28:19] [S4] And so it stores this information in such a way that if that value changes in the future, that's easy.
[01:28:27] [S4] React knows that because you called set state.
[01:28:30] [S4] All the other signal systems, they have a similar way of mutating the value.
[01:28:34] [S4] So when the value mutates, now the system knows, okay, I know who to notify to update.
[01:28:41] [S4] Whereas React, or a coarse grained system, also Angular falls into this category as well.
[01:28:45] [S4] Well, now Angular has signals.
[01:28:47] [S4] But before signals in Angular, the framework would be just like, I have no idea.
[01:28:53] [S4] The only reasonable thing to do is to rerender the whole world.
[01:28:57] [S6] I see.
[01:28:58] [S6] And as I understand it, so the magic is happening at the compiler, looking at the usage of the value, and then
[01:29:09] [S4] No, the magic happens at runtime.
[01:29:11] [S6] So it's happening at the run.
[01:29:13] [S6] So my question is, can we can we add signals to the React is a question?
[01:29:22] [S4] Yes and no.
[01:29:23] [S4] So yes, because kind of Preact already did it, right?
[01:29:26] [S4] So that definitely can be added.
[01:29:28] [S4] But it's it's it requires slight changes in the way you think about the problem.
[01:29:37] [S4] And the question really isn't about like, can you add signals to react it's more like if we add signals to React, are we willing to change the developer's mental model of what React is?
[01:29:53] [S6] I see.
[01:29:54] [S4] And so the issue isn't so much as in a technical issue, as in that doing so, you are asking the developers to think about the problem differently.
[01:30:05] [S4] And is that different way of thinking about it?
[01:30:07] [S4] Is it React?
[01:30:09] [S4] React, for example, really, really prides itself on the idea of pure functions.
[01:30:14] [S4] It's just a bunch of functions that you call in any order you want, and it just kind of works.
[01:30:18] [S4] That's kind of their identity.
[01:30:20] [S4] And with signals that identity changes slightly.
[01:30:22] [S4] And so the question then becomes like, is that the identity that the core React team wants for its goals?
[01:30:33] [S6] I see, I see.
[01:30:35] [S4] But signals are also kind of like I mentioned are kind of a prerequisite for reasonability.
[01:30:42] [S4] Because as I said, you could in theory resume something like React.
[01:30:49] [S4] But the problem you would have is that the moment something would change, you would be forced to download and re-execute the whole application.
[01:30:57] [S4] And so it's almost like you work so hard to get resumability only to like lose it the last inch of the way.
[01:31:07] [S6] Because you're not shipping the closure to to the front and you just shipping the result or a kind of executed function?
[01:31:18] [S4] So reasonability makes sense.
[01:31:21] [S4] Only if you can guarantee that the amount of code that you're going to have to lazy execute is not too much.
[01:31:30] [S4] And so if if the first interaction basically says that I need to download the whole codebase and execute the whole codebase, then it's like, well, why do all this work to delay it?
[01:31:41] [S4] You're not really gaining anything, right?
[01:31:43] [S4] And so resume mobility has a strong preference for fine grained systems.
[01:31:50] [S6] I see.
[01:31:53] [S6] Yeah, thank you.
[01:31:54] [S6] Thank you for that.
[01:31:58] [S4] You know, you asked me like, is this alien technology?
[01:32:01] [S4] No, it's not.
[01:32:03] [S4] But the way I think about this particular problem is that you set a goal for yourself.
[01:32:09] [S4] And for the case of a QUIC, the goal is very simple, which was delay execution of the code.
[01:32:16] [S4] And so then you can ask yourself, well, how aggressive do you want to be about this goal?
[01:32:21] [S4] And I find that in life, a lot of times, it's easier to just pick extremes because then you don't have to like have a debate about it.
[01:32:30] [S4] Like you either smoke or you don't smoke, right?
[01:32:34] [S4] There is very difficult to be like, I only smoke one cigarette a day, right?
[01:32:40] [S4] So like, it's much easier to be at the extreme.
[01:32:42] [S4] So so when we were when I started working on Qlik, my philosophy was very simple, which is like, I want to be in a situation where the only time when I download a piece of code is if I execute it.
[01:32:55] [S4] So that I will essentially always be in a situation that if I look up code coverage of my code base, it should be pretty close to 100% at all times.
[01:33:05] [S4] It seems like a crazy extreme thing, but then you just work backwards from that.
[01:33:10] [S4] And you say, you're like, okay, so how do I get there?
[01:33:12] [S4] Like, what do I need to do in order to get there?
[01:33:15] [S4] And so you kind of come to the conclusion like, well, you need to be able to, you know, start at the listener, right?
[01:33:20] [S4] Like, because the listener, when you click on a button, the first thing that executes is the listener handler.
[01:33:26] [S4] So how do you get the listener handler?
[01:33:29] [S4] Solve that problem.
[01:33:30] [S4] How does the listener get a state?
[01:33:32] [S4] Solve that problem.
[01:33:32] [S4] And then just keep solving it until you either have a moment where this is impossible, or you sleep on it and somehow figure out how to get over that problem and keep going.
[01:33:42] [S4] And so so QUIC is just kind of the result of that particular point of view.
[01:33:49] [S4] And I'm not saying that your application should only download the code when it has to execute it.
[01:33:54] [S4] But I'm saying is, by starting at that point of view, it allows you to build all of these solutions.
[01:34:01] [S4] And then later, you can always back off on it.
[01:34:06] [S6] That's very interesting.
[01:34:07] [S6] I guess that might be, you know, if you had started at solving a different problem, you might have Yeah, you might have arrived at a very different situation, like where instead of having that problem or of only downloading the code that that's going to be executed, you try to optimize the way the state works or some other piece of the problem essentially.
[01:34:39] [S6] Then you would be basically basically reinventing some piece of the existing existing system rather than reimagining how the system could be built from from the ground up.
[01:34:53] [S4] Yeah, I think that's a good way of putting it.
[01:34:56] [S4] When I kind of started this, I was very cognizant of the fact that there are lots of different frameworks out there.
[01:35:05] [S4] And what I didn't want to do is to just build yet another framework that just has a different DX.
[01:35:11] [S4] DX is important, but I don't think it's it's not something I basically wanted to do.
[01:35:18] [S4] And so my very key requirement at the very, very beginning was, if I'm going to do this, it has to solve a problem that others cannot solve.
[01:35:28] [S4] It has to be something that is just a fundamentally different thing that that can provide value that cannot be solved in other ways.
[01:35:37] [S4] And so this is basically what was the motivation for it.
[01:35:41] [S4] And when I started working on this project, I actually didn't want to solve the like the all of it.
[01:35:48] [S4] Like I was just like, oh, can I just reuse an existing renderer like a React or Lit or some other rendering system?
[01:35:55] [S4] And I looked into it and I started building prototypes, but very quickly I just kind of realized that it just doesn't fit.
[01:36:02] [S4] This idea of of being able to lazy load code anywhere and all the time is so pervasive, mainly because it returns a promise to you, that you need to have a system and a rendering pipeline, etc., that at any point needs to be able to be handed a promise and it needs to be okay with it and not kind of blow up.
[01:36:24] [S4] And many existing systems are not really good at dealing with promises.
[01:36:30] [S4] It's just not native to them, right?
[01:36:33] [S4] You can't just when you look at the rendering APIs of existing systems they're all fully synchronous.
[01:36:39] [S4] Like when I call render, it's a synchronous update.
[01:36:42] [S4] I see.
[01:36:43] [S4] And yeah, there are tricks like React will throw an exception to tell you like, oh, the promise is not to resolve try again later, right?
[01:36:50] [S4] But you end up in the state where like, you know, half the stuff is already rendered and the other stuff is still missing because it hasn't showed up.
[01:36:57] [S4] So for example, quick rendering pipeline has to understand this and say, like, look, I am collecting all the changes I'm going to do to the DOM, but until every single bit of it is resolved, I am not rendering it.
[01:37:09] [S4] And so it's a different kind of a paradigm and a different rendering model.
[01:37:14] [S4] And so these are the things that I kind of realized that as much as I would like to reuse existing systems, because I don't want to build everything from scratch, it wasn't really possible to to get to the world, which was highly lazy loadable, like I wanted to get to without also solving these other bits.
[01:37:33] [S4] Also, we didn't, as I said at the very beginning, we didn't want to build the Meta Framework either.
[01:37:37] [S4] But it turns out if you don't build the Meta Framework, then you cannot really show off the capabilities of the framework itself.
[01:37:48] [S6] Yeah, so we are very glad.
[01:37:49] [S6] I'm sure all the people who are looking at at Quick are very glad that you made that decision.
[01:37:56] [S6] And it seemed like, you know, as I said, we've had, we have chart meetings and chats about this internally.
[01:38:05] [S6] And it looks like the perfect, you know, if you think about the perfect architecture for building websites, it seems like quick is doing that.
[01:38:14] [S6] So thank you for thank you for that.
[01:38:17] [S6] But I'm just wondering, like, what is what is coming down the pipeline next?
[01:38:23] [S6] Like, what are some of the things that I am not imagining at the moment that that could be solved or could be could be done differently and would provide a lot of value.
[01:38:35] [S6] to the to the web ecosystem?
[01:38:38] [S4] Yeah, good question.
[01:38:39] [S4] First of all, thank you for the kind words I appreciate it.
[01:38:41] [S4] I like to oftentimes say we are trying to do every single performance trick that we can think of.
[01:38:49] [S4] Like if you can think of yet another performance trick that you could do, the QUIC isn't already doing, do let me know, because we'll probably integrate that one too.
[01:38:57] [S4] So everything from lazy loading to prefetching to lazy execution, resumability, like everything we can think of.
[01:39:03] [S4] It's all all in there.
[01:39:06] [S4] You're saying what's coming past 1.0.
[01:39:08] [S4] So there's certain things that didn't make it to 1.0.
[01:39:10] [S4] And I'm kind of sad, but there's there's only so much we can do.
[01:39:15] [S4] One is out of order streaming.
[01:39:17] [S4] It is still something that we want to do, and I think we can do some amazing trickery with that.
[01:39:23] [S4] That's going to come after 1.0.
[01:39:25] [S4] And we are working with our friends in Cloudflare, and they're building some amazing demos with microfrontends.
[01:39:33] [S4] Unfortunately, microfrontends have not made it into the main documentation yet.
[01:39:38] [S4] So we definitely want to do stuff around micro frontends because we think QUIC is really good architecture for micro frontends.
[01:39:45] [S4] But it requires a lot more documentation, a lot more explaining, a lot more kind of changes.
[01:39:50] [S4] And so we're not there yet.
[01:39:52] [S4] And so that's also not part of V1.
[01:39:54] [S4] So I think those are going to be the two big pieces that are going to happen afterwards.
[01:40:00] [S6] That's very interesting.
[01:40:00] [S6] So actually, this might be one of the things that we're considering is Um, because we have, we're kind of controlling, um, the, the request from the browser essentially, because, you know, we have, if you build websites on top of Edge your sites, there are some client side code that's shipped to the to the browser, and that includes the service worker by Geo to kind of prefetch some things.
[01:40:29] [S6] And then we're also controlling the CDN software and then the back end as well, because our SSR serverless systems are rendering the website.
[01:40:40] [S6] So one of the things that we're considering at the CDN level is edge size, something like edge size includes.
[01:40:51] [S6] So I'm just wondering if you could specify thinking about micro microfront and you could specify, oh, this is the, this is the ESI tag for header and this is the ESI tag for the shopping cart or something.
[01:41:08] [S6] And then just a a service worker can can render that and add that into the into the existing response.
[01:41:17] [S4] Yeah.
[01:41:18] [S4] Actually, yeah, that's exactly what we're thinking about.
[01:41:22] [S4] We actually have a nice demo already.
[01:41:24] [S4] So there is a URL you can go try it out.
[01:41:27] [S4] Is it working?
[01:41:31] [S4] Oh, looks like it.
[01:41:32] [S4] Oh, no, it works.
[01:41:33] [S4] So if you go to quick dash dream dash dream-demo.pages.dev.
[01:41:41] [S4] It's exactly what you're talking about.
[01:41:42] [S4] The idea is that we want to be able to render a page and server side include different parts.
[01:41:49] [S4] But the different parts we're including are actually standalone applications.
[01:41:54] [S4] If you think about it, including stuff on a server is relatively easy, but there's more to it than just that.
[01:42:02] [S4] If you just include a chunk of code, chunk of HTML, and then the client side framework wakes up and starts doing hydration, it will override the stuff that you've included.
[01:42:12] [S4] So you have to it's not just about just including the HTML.
[01:42:15] [S4] It's also about doing it in such a way that when hydration happens, the hydration doesn't destroy the work that you have done.
[01:42:22] [S4] And it turns out QUIC is really good at this, the architecture of QUIC.
[01:42:26] [S4] And so that demo actually shows off specifically this, that we actually have the menu running in a separate web worker from the shopping cart, running in a separate web worker from the not a web worker, Edge worker, from from the hero image, from the product, from the comments.
[01:42:45] [S4] And then all of these things get server side bundled together.
[01:42:50] [S4] The advantage is that different parts can be cached at different level.
[01:42:54] [S4] And then all become interactive on a client.
[01:42:57] [S4] You can add a button from the main page and the shopping cart updates, even though shopping cart is a separate server side include from the button that adds to the buying button.
[01:43:10] [S6] Yeah, this is excellent.
[01:43:11] [S6] This is this is exactly this is even better than what I was thinking, but you know, this is a kind of realization of an idea I had.
[01:43:20] [S6] Excellent.
[01:43:20] [S5] Yeah.
[01:43:21] [S4] So yeah, I think there's a button over there on that side called Show Scenes that actually shows you all of the servers that include URLs and where they're coming from, etc.
[01:43:29] [S4] And yeah, it is it is kind of the next step, I think, in evolution.
[01:43:33] [S4] like if you look at a super complicated site like Amazon, it might be impossible to server side render it.
[01:43:43] [S4] But if you break it up into pieces, you realize, well, there There's only so many hero images that I can show.
[01:43:49] [S4] It's not infinite.
[01:43:50] [S4] And I can pre-render them.
[01:43:51] [S4] And then all I need to know is which one to include over here.
[01:43:55] [S4] And the server side include is inexpensive.
[01:43:59] [S4] And then if all of these actually works with streaming, then you can get into a situation where you you send the menu and the shopping cart.
[01:44:06] [S4] And let's say the shopping cart needs to talk to database to figure out what's in your shopping cart.
[01:44:10] [S4] And it says, you know what?
[01:44:11] [S4] I'm going to take some time.
[01:44:12] [S4] So don't don't wait on me.
[01:44:13] [S4] Just keep rendering.
[01:44:14] [S4] And so you render the other parts.
[01:44:16] [S4] And then the shopping cart finally figures out what the answer is.
[01:44:19] [S4] And then sends back an update.
[01:44:20] [S4] Says like, okay, I know the answer is now three.
[01:44:22] [S4] So go and update it to three.
[01:44:24] [S4] And so initially, you would render a page that would have maybe a question mark for a shopping cart.
[01:44:29] [S4] And then once the database returns, it goes and updates with the actual thing.
[01:44:32] [S4] So that's what we call the out of order streaming.
[01:44:34] [S4] And it's something that's coming.
[01:44:35] [S4] And it's not only would come here, but we would work in a way where it could be through server side include, right?
[01:44:44] [S4] So if I server side include a shopping cart, the inclusion needs to understand the fact that like, oh, by the way, that shopping cart is not fully done.
[01:44:54] [S4] There's going to be an update coming down later, but don't wait up on me.
[01:44:57] [S4] Go go start rendering the hero in the meantime, which is a separate edge worker.
[01:45:02] [S4] And so when this edge worker finally figures out what the what the update is, then come back and update it.
[01:45:08] [S4] Another example of that would be, let's say you want to show somebody a product and you want to show how many items are still available in stock.
[01:45:16] [S4] That might be relatively expensive.
[01:45:17] [S4] query.
[01:45:18] [S4] And so you just want to show the item and for the stock availability, just say computing or something like that, or a spinner.
[01:45:26] [S4] And then a second or two later, that spinner would update with the actual number.
[01:45:31] [S6] That's that's amazing.
[01:45:35] [S5] Cool.
[01:45:35] [S5] So we're going to
[01:45:36] [S2] Start wrapping up soon, but I think we have one more person who has a question,
[01:45:40] [S5] Val.
[01:45:42] [S17] Hi, FSGM folks.
[01:45:44] [S17] This is Val from Waterloo, Canada.
[01:45:45] [S17] I love your show, especially the opening music.
[01:45:48] [S17] That's fantastic.
[01:45:49] [S5] Thank you.
[01:45:51] [S5] Me actually.
[01:45:52] [S5] Yeah.
[01:45:53] [S17] Um Mishka, this is Val Neekman.
[01:45:55] [S17] How are you, my friend?
[01:45:57] [S5] Hey, how's it going?
[01:45:58] [S17] Not bad, not bad.
[01:45:59] [S17] Yesterday, I was going through the documentation and everything.
[01:46:03] [S17] Try to wrap my head around what quick is quickly.
[01:46:08] [S17] And So I managed to raise the PR in the process as well.
[01:46:13] [S17] One thing that I noticed that a lot of people, they're getting really excited and they wanted to come and talk about the things they learned about quick.
[01:46:22] [S17] on YouTube.
[01:46:23] [S17] And sometimes I realize that they have not been able to wrap their head around what QUIC is.
[01:46:29] [S17] And when the documentation is falling behind the development for too long, then those YouTubes, they show up, they will mislead a lot of people.
[01:46:39] [S17] Now, my question is, will you be allocating some time, let's say half a day for everybody get together and take care of the namings because I noticed that so many names are flipping back and forth, back and forth.
[01:46:55] [S17] As an example, use visibility task, which is the final name for it.
[01:47:00] [S17] And so that's one question The last question is, is browser is understood?
[01:47:06] [S17] Is client is understood?
[01:47:08] [S17] Next.js decided to call everything server side unless you specify the specific specifically.
[01:47:15] [S17] But this server and an edge function that is being advertised as serverless, it just doesn't make sense.
[01:47:22] [S17] It might confuse the young folks.
[01:47:25] [S17] So is there any way that we could remove a server and just use, if not, browser?
[01:47:32] [S17] Those are the questions that I have.
[01:47:33] [S17] Thank you.
[01:47:35] [S5] Yeah.
[01:47:35] [S4] So yeah, I mean, you kind of are hitting the hell in the head, so to speak, why exactly we're not in version 1.0.
[01:47:40] [S4] yet.
[01:47:41] [S4] There's still a lot of polish that has to happen.
[01:47:45] [S4] And, you know, it turns out a lot of it is actually done by community and community is helping us.
[01:47:51] [S4] There are lots of awesome people like Shai Resnik who are organizing others to help with the documentation, help with the starters, improve the starters, the CLI, and things of that sort.
[01:48:02] [S4] So all of that stuff is just extra work that has to has to happen.
[01:48:06] [S4] And yes, you're right.
[01:48:07] [S4] We have we originally had the task called what's called I think use Klein effect.
[01:48:14] [S4] The problem we discovered is that people came to Quake with the pre-existing notion, what the use effect is in React.
[01:48:23] [S4] And so they started putting all kinds of stuff inside of use client effect that really wasn't fitting.
[01:48:30] [S4] I kind of talked about the listeners and so on.
[01:48:32] [S4] And so the rename actually was kind of motivated by the fact that we wanted to actually distance ourselves from the word effect, because so many people have a preconceived notion of what it is.
[01:48:45] [S4] And it turns out that's not what it is exactly in quick.
[01:48:49] [S4] And so if you just come along and bring your notions and habits, then you're going to end up rebuilding application in a way that is not performant.
[01:49:00] [S4] And so that's kind of the motivation behind it.
[01:49:02] [S4] So yeah, it's a hard problem, but I think we're getting there slowly.
[01:49:08] [S4] And of course, I will encourage you to kind of help with it.
[01:49:10] [S4] If you wanted to help with the documentation or anything like that, by all means, jump in and help us.
[01:49:16] [S17] Absolutely.
[01:49:17] [S17] I got my PR merged in yesterday and I'm just warming up.
[01:49:22] [S17] So yeah, expect more PR friendly.
[01:49:24] [S17] Thank you.
[01:49:25] [S4] Excellent.
[01:49:25] [S4] Excellent.
[01:49:29] [S2] Awesome.
[01:49:30] [S2] Well, I think this is going to about wrap it up for us.
[01:49:34] [S2] Thank you so much, Misko.
[01:49:35] [S2] This has been such a great conversation.
[01:49:38] [S2] And thank you everyone who came up to ask questions and speak.
[01:49:42] [S2] And yeah, I think, you know, you have your Twitter right here.
[01:49:45] [S2] People can follow you.
[01:49:47] [S2] And they can check out builder.io and quick.
[01:49:50] [S2] Are there other links you want people to be directed to?
[01:49:54] [S4] Yeah, Builderio, Quick and Partytown, I think, are the main places to go.
[01:49:58] [S4] And of course, from the quick.builderio, you can check out our link to our Discord and there's lots of friendly folks to help you out.
[01:50:08] [S6] Yeah, and actually at the end, I would like to thank Misko myself as well.
[01:50:15] [S6] And thank you for for coming here and thank you for, especially for the work that you're doing and and the contribution that you're making to the JavaScript ecosystem and the web ecosystem in general.
[01:50:29] [S6] So thank you for that and and good luck.
[01:50:33] [S4] Thank you for the kind words.
[01:50:34] [S4] I appreciate
[01:50:35] [S5] It.
[01:50:35] [S5] Yes,
[01:50:35] [S3] Yes, everybody.
[01:50:36] [S3] Let's give Misko a huge round of applause.
[01:50:41] [S5] Yeah.
[01:50:46] [S3] Oh, the applause had to stop.
[01:50:49] [S3] So unfortunate.
[01:50:51] [S5] I love you so much.
[01:50:52] [S3] Thank you so much, everybody.
[01:50:58] [S3] We've been so, so good here today.
[01:50:59] [S3] Thank you for all this wonderful time that you've given here in your busy day and schedule.
[01:51:08] [S3] Greatly appreciate everybody also coming in the audience there and listening in.
[01:51:12] [S3] And if you come up to speak, thank you so much for that too.
[01:51:16] [S3] And just remember, we will be here every Wednesday at 12 p.m.
[01:51:19] [S3] Pacific Standard Time as always.
[01:51:21] [S3] And be sure to give us a follow on JavaScript jam there and go subscribe to JavaScript jam.com on the newsletter there so you won't be left out on any of the awesome things coming up.
[01:51:31] [S3] So, with that being said, Um really excited for the future here.
[01:51:36] [S3] We're going to be doing some events.
[01:51:37] [S3] Uh in fact, uh one that I will announce um we are going to be doing some collaboration with Remix Conference and um we got more to come on that in the near future.
[01:51:50] [S3] And there's a couple more events as well that we'll be talking about soon.
[01:51:54] [S3] But yeah, I'm excited about the remix conference coming up here in the near future.
[01:52:00] [S3] and we're going to be having some speakers from there.
[01:52:03] [S3] Come on here as well and join us to just have some great conversation.
[01:52:07] [S3] So keep an eye out for all that.
[01:52:10] [S3] Join the newsletter for more information.
[01:52:12] [S3] All right.
[01:52:13] [S3] Thank you all so much.
[01:52:15] [S3] Really appreciate it.
[01:52:16] [S3] And we'll see you in the next one.
[01:52:25] [S18] Thank you.
[01:52:40] [S5] Ja.