---
title: "2022-09-30-widgets-fsjam-40-minutes"
slug: "2022-09-30-widgets-fsjam-40-minutes"
duration: "Unknown"
channel: "Unknown"
url: "https://ajc.pics/autoshow/benchmarks/stt/2022-09-30-widgets-fsjam-40-minutes.mp3"
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
[00:00:10] [speaker-0] Today is going to be slightly a bit of a different episode.
[00:00:13] [speaker-0] I've been,
[00:00:14] [speaker-0] you could say,
[00:00:14] [speaker-0] nailing away on a lot of things in the background on Everfund.
[00:00:18] [speaker-0] One of these subject areas that always comes up that I am always interested to try and share more about is scripts.
[00:00:24] [speaker-0] When you build a website,
[00:00:26] [speaker-0] you know if it's a standard blog or even a SaaS app,
[00:00:29] [speaker-0] you're probably going to be installing loads of script by a marketing department if you have one,
[00:00:33] [speaker-0] or just by your customers.
[00:00:34] [speaker-0] Maybe that's Google Analytics,
[00:00:36] [speaker-0] Fathom,
[00:00:37] [speaker-0] or maybe something more interactive like Intercom.
[00:00:40] [speaker-0] I've been building scripts out at Everfund,
[00:00:42] [speaker-0] and it's been one hell of a journey.
[00:00:44] [speaker-0] And this is something that I wanted to explore in an episode with Anthony and just really talk over the biggest pitfalls that I've found,
[00:00:51] [speaker-0] the biggest like head scratches.
[00:00:53] [speaker-0] Why do we do it this way?
[00:00:54] [speaker-0] How do you even make a script for your company?
[00:00:56] [speaker-0] It's kind of this black magic that I think nobody's really described a best way of doing,
[00:01:01] [speaker-0] and we've all just kind of made it up along the way,
[00:01:03] [speaker-0] and it all just works because obviously it's JavaScript.
[00:01:07] [speaker-0] But I think it's a really interesting subject area that I wanted to sit down with you and explore.
[00:01:11] [speaker-1] Yeah,
[00:01:12] [speaker-1] this is something I definitely don't know much about.
[00:01:14] [speaker-1] I've never had to write a third party script or really integrate a third party script too much.
[00:01:20] [speaker-1] I've
[00:01:21] [speaker-1] Definitely done things with like my dev blog or my hash node blog.
[00:01:25] [speaker-1] That would be stuff like that,
[00:01:27] [speaker-1] but they kind of give you the ability to just like plug and play things.
[00:01:30] [speaker-1] I have something that can like track reads,
[00:01:33] [speaker-1] and then I get like micro payments or something,
[00:01:35] [speaker-1] and I get like three dollars a year for my blog posts or something.
[00:01:38] [speaker-1] So I know that there's a lot of these things,
[00:01:40] [speaker-1] and they're basically black boxes to me.
[00:01:42] [speaker-0] And the thing is,
[00:01:43] [speaker-0] this is actually what makes it more interesting.
[00:01:45] [speaker-0] The way they kind of can be hosted means that they technically don't have to be open source.
[00:01:50] [speaker-0] They can keep all the source code,
[00:01:53] [speaker-0] obviously,
[00:01:53] [speaker-0] how they make the scripts behind their private repositories,
[00:01:57] [speaker-0] and then only give you a bundled version.
[00:01:59] [speaker-0] I've actually seen that with a few,
[00:02:01] [speaker-0] and others,
[00:02:02] [speaker-0] like for example,
[00:02:03] [speaker-0] version controlling is another one.
[00:02:05] [speaker-0] There's so many questions here,
[00:02:06] [speaker-0] so I think the best place to start is how do you make a script?
[00:02:11] [speaker-0] How do you make a script that can run on the internet?
[00:02:15] [speaker-0] So outside of your own domain,
[00:02:17] [speaker-0] outside your own website.
[00:02:18] [speaker-0] And it runs some JavaScript on someone else's website.
[00:02:21] [speaker-0] The first step to do that is you gotta work out what you want to write.
[00:02:26] [speaker-0] If you want to write TypeScript or JavaScript,
[00:02:28] [speaker-0] you can bundle further libraries into it,
[00:02:32] [speaker-0] like Svelte and even React.
[00:02:34] [speaker-0] If you want to make a really quite heavy script,
[00:02:36] [speaker-0] but if you want something really light,
[00:02:38] [speaker-0] you tend to be using just plain JavaScript.
[00:02:41] [speaker-0] And this is actually really interesting because I found it actually really hard to actually just use.
[00:02:48] [speaker-0] Plain vanilla JavaScript to build this script because you're so used to abstracted libraries on how to build these things that when you actually have to use the core JavaScript,
[00:02:58] [speaker-0] it really is empowering.
[00:03:00] [speaker-0] At the same time,
[00:03:00] [speaker-0] so the biggest thing is you have to start somewhere,
[00:03:04] [speaker-0] and some people have open source scripts.
[00:03:07] [speaker-0] I have mine open source,
[00:03:08] [speaker-0] so you can always look at the source code to this episode to what I have built.
[00:03:12] [speaker-0] And it first starts with a micro bundler,
[00:03:16] [speaker-0] a bundler.
[00:03:17] [speaker-0] And that needs to output whatever that JavaScript is.
[00:03:20] [speaker-0] So say it's just we're going to go really simple,
[00:03:22] [speaker-0] and all it is is a function that says "Hello World."
[00:03:26] [speaker-0] You've tested it and it runs.
[00:03:27] [speaker-0] So then you need to bundle it.
[00:03:29] [speaker-0] How the internet actually works is,
[00:03:30] [speaker-0] as you know,
[00:03:31] [speaker-0] JavaScript can be bundled into multiple different variants,
[00:03:34] [speaker-0] from Common JS to
[00:03:36] [speaker-0] ESM to AMD.
[00:03:38] [speaker-0] But the biggest one,
[00:03:39] [speaker-0] and this is how weird the internet is,
[00:03:42] [speaker-0] is UMD,
[00:03:43] [speaker-0] and this has caused so many problems.
[00:03:45] [speaker-0] So Anthony.
[00:03:46] [speaker-0] Do you know what UMD is?
[00:03:48] [speaker-1] I've heard of UMD,
[00:03:49] [speaker-1] and I've heard of all of these module things because I've listened to like podcasts,
[00:03:54] [speaker-1] like read blog posts about the history of it.
[00:03:56] [speaker-1] It's actually a really good one by Tyler McGinnis that we'll link to in the show notes.
[00:03:59] [speaker-1] But I know that the main thing is that you had a module definition for Node,
[00:04:04] [speaker-1] which was CommonJS,
[00:04:05] [speaker-1] and so that's the one that most people were using because so many people were writing Node.
[00:04:09] [speaker-1] It was just extremely common to have that kind of syntax,
[00:04:12] [speaker-1] so everything that could work on npm could work everywhere else.
[00:04:15] [speaker-1] But then you also had things that were meant to work in the browser,
[00:04:18] [speaker-1] which I believe was originally AMD,
[00:04:20] [speaker-1] which was Asynchronous Module Definition,
[00:04:22] [speaker-1] and then that eventually kind of morphed into
[00:04:25] [speaker-1] ESM, which is ECMAScript.
[00:04:27] [speaker-1] And I've heard of UMD,
[00:04:28] [speaker-1] but I thought that ECMAScript is what the browsers were supposed to be implementing.
[00:04:32] [speaker-1] And this UMD repo that we'll also link to that you sent me,
[00:04:36] [speaker-1] no one's even done anything with this since twenty seventeen.
[00:04:38] [speaker-1] So I don't really understand how UMD is.
[00:04:40] [speaker-0] The standard that's being used—it's really weird because you build your script.
[00:04:45] [speaker-0] If you're using something like TSDX,
[00:04:47] [speaker-0] is what we originally built with,
[00:04:48] [speaker-0] it would spit out two versions:
[00:04:50] [speaker-0] your common JS and your ASM.
[00:04:52] [speaker-0] You're like,
[00:04:52] [speaker-0] "That's it,
[00:04:53] [speaker-0] done.
[00:04:53] [speaker-0] We're done here.
[00:04:54] [speaker-0] We have the script."
[00:04:55] [speaker-0] And then you actually try to load it into a website using one of these interesting loader functions,
[00:05:01] [speaker-0] where you like basically have the script on a URL,
[00:05:04] [speaker-0] and the JavaScript is basically to inject the script onto the page.
[00:05:08] [speaker-0] Asynchronously load it and then call it to initialize it.
[00:05:12] [speaker-0] What these load scripts are,
[00:05:14] [speaker-0] every one of them tend to look the same.
[00:05:16] [speaker-0] If you did that with a CommonJS module,
[00:05:18] [speaker-0] it would just error and say,
[00:05:19] [speaker-0] "I don't know what to do.
[00:05:20] [speaker-0] This isn't working.
[00:05:21] [speaker-0] This reference isn't there."
[00:05:23] [speaker-0] That's why you have to actually bundle down to UMD.
[00:05:26] [speaker-0] Currently,
[00:05:27] [speaker-1] well,
[00:05:27] [speaker-1] so what would happen if you just did regular ECMAScript ECMAScript modules?
[00:05:31] [speaker-1] Where would it error there?
[00:05:32] [speaker-0] So CommonJS errored.
[00:05:34] [speaker-0] That's ESM,
[00:05:34] [speaker-0] right?
[00:05:35] [speaker-0] ECMAScript ESM.
[00:05:36] [speaker-1] No,
[00:05:36] [speaker-1] so CommonJS is the require one,
[00:05:38] [speaker-1] is one that you do const declare a variable and then you do require,
[00:05:42] [speaker-1] then you require the dependency.
[00:05:44] [speaker-1] Whereas ESM,
[00:05:45] [speaker-1] you do import,
[00:05:46] [speaker-1] use the import keyword and then from,
[00:05:49] [speaker-1] and then whatever you want to import from.
[00:05:51] [speaker-1] So I would be curious what would happen if you just tried to just write it like you would like React when you're just like importing stuff like that.
[00:05:58] [speaker-1] That is ECMAScript modules.
[00:05:59] [speaker-1] So what happens if you try and do that?
[00:06:01] [speaker-0] Well,
[00:06:02] [speaker-0] I think the simplest answer is that I don't really know because I don't think I compiled to ECMAScript.
[00:06:07] [speaker-1] We don't need to compile to ECMAScript because the browser just—it's built into the browser.
[00:06:11] [speaker-0] It's built into the browser.
[00:06:12] [speaker-0] Yeah.
[00:06:13] [speaker-0] So maybe my big problem here was that I was using TypeScript first.
[00:06:17] [speaker-0] Is that you've obviously got to bundle out TypeScript,
[00:06:21] [speaker-0] i.e.,
[00:06:21] [speaker-0] compile down.
[00:06:22] [speaker-0] This is actually quite an interesting question because this is the thing:
[00:06:25] [speaker-0] ECMAScript.
[00:06:26] [speaker-0] I didn't actually try.
[00:06:27] [speaker-0] All my headaches and all my problems all came off.
[00:06:31] [speaker-0] Of bundling extra modules into the code,
[00:06:35] [speaker-0] UMD obviously works for all browsers,
[00:06:38] [speaker-0] but it is also not deprecated.
[00:06:41] [speaker-0] But we're now leaning more to ESM modules.
[00:06:44] [speaker-0] What you tend to find with a tool like Microbundle is that when it bundles the code,
[00:06:50] [speaker-0] it will bundle it to
[00:06:51] [speaker-0] UMD,
[00:06:52] [speaker-0] CommonJS, and ESM.
[00:06:55] [speaker-0] They're the three that it bundles down to,
[00:06:57] [speaker-0] and I don't know why it doesn't bundle down to ECMAScript.
[00:07:00] [speaker-1] No,
[00:07:00] [speaker-1] ESM is ECMAScript.
[00:07:01] [speaker-1] ESM is ECMAScript modules.
[00:07:04] [speaker-0] So it is.
[00:07:04] [speaker-0] So that should work on everyday browsers,
[00:07:08] [speaker-0] and it does.
[00:07:09] [speaker-0] It does.
[00:07:10] [speaker-0] But this is actually a really interesting question as well:
[00:07:12] [speaker-0] is support?
[00:07:13] [speaker-0] We did a Can I Use on ESM modules,
[00:07:17] [speaker-0] and it says to me ninety-three percent of the users of the internet can use ESM because IE eleven doesn't support it,
[00:07:25] [speaker-1] and then
[00:07:26] [speaker-1] Opera Mini doesn't support it,
[00:07:28] [speaker-1] and that's.
[00:07:29] [speaker-1] Pretty much it,
[00:07:30] [speaker-0] and then obviously earlier versions of Chrome.
[00:07:33] [speaker-0] We're now on Chrome 100,
[00:07:34] [speaker-0] and Chrome 60 was the last one that didn't.
[00:07:36] [speaker-0] So this is also another big question when it comes down to business:
[00:07:39] [speaker-0] is when is it okay to deprecate the older version?
[00:07:44] [speaker-0] Because we have a bundled version of ESM and UMD,
[00:07:48] [speaker-0] and the UMD version is actually bigger in terms of script size because it's using older JavaScript terms.
[00:07:54] [speaker-0] When is the right time to define that you're going to only use
[00:07:58] [speaker-0] ESM because this is a script that you need to work every time,
[00:08:04] [speaker-0] hundred percent of the time.
[00:08:05] [speaker-0] You need to work.
[00:08:05] [speaker-0] You need to load your function,
[00:08:07] [speaker-0] or your business can't work.
[00:08:08] [speaker-0] Imagine if Intercom only worked on ESM.
[00:08:11] [speaker-0] Well,
[00:08:11] [speaker-0] that's ninety two percent of the websites.
[00:08:13] [speaker-0] Is eight percent of websites it not loading on okay?
[00:08:17] [speaker-0] And that's a really good question.
[00:08:19] [speaker-1] Well,
[00:08:19] [speaker-1] depends.
[00:08:20] [speaker-1] Would you have the ability to show a message saying this requires Chrome to work?
[00:08:24] [speaker-0] No,
[00:08:24] [speaker-0] I think it would just error and be like,
[00:08:26] [speaker-0] I can't even.
[00:08:27] [speaker-0] Compile this JavaScript in the browser.
[00:08:29] [speaker-1] Couldn't you do a polyfill though?
[00:08:30] [speaker-0] Hmm.
[00:08:31] [speaker-0] Probably.
[00:08:31] [speaker-0] But the problem with polyfills is that you also have to bundle that with the script.
[00:08:35] [speaker-0] Oh no!
[00:08:35] [speaker-0] Unless you bundle it outside the script.
[00:08:36] [speaker-0] Hmm.
[00:08:37] [speaker-1] Yeah.
[00:08:37] [speaker-1] The polyfills add bloat for sure.
[00:08:39] [speaker-0] Yeah.
[00:08:40] [speaker-0] This is actually a super interesting thing.
[00:08:41] [speaker-0] As we're debating all this,
[00:08:43] [speaker-0] when you search how to build a widget,
[00:08:45] [speaker-0] there's hardly any articles out there compiling it down.
[00:08:48] [speaker-0] Like this was actually really interesting.
[00:08:49] [speaker-0] Was that when I used Micro Bundler and said output
[00:08:54] [speaker-0] UMD files?
[00:08:55] [speaker-0] It couldn't even do it.
[00:08:57] [speaker-0] It would give you a file that wasn't valid.
[00:08:59] [speaker-0] So then I had to use Rollup to specifically make UMD files.
[00:09:03] [speaker-0] I have Microbundle creating the bundle for CommonJS and ESM,
[00:09:08] [speaker-0] and then I have Rollup creating the bundle for UMD.
[00:09:12] [speaker-0] Why is this really important in the world of Everfund?
[00:09:16] [speaker-0] We make a WordPress plugin,
[00:09:18] [speaker-0] and that's scary.
[00:09:19] [speaker-0] No,
[00:09:19] [speaker-0] I'm joking,
[00:09:20] [speaker-0] but we need this plugin to work on.
[00:09:22] [speaker-0] Every website,
[00:09:23] [speaker-0] and this was actually also a massive problem.
[00:09:25] [speaker-0] Was actually getting it working on WordPress because WordPress did some funky things with it as well about hosting.
[00:09:31] [speaker-0] So we went with UMD option.
[00:09:34] [speaker-0] We also chose the option to have it open source,
[00:09:37] [speaker-0] so the source code is open,
[00:09:38] [speaker-0] and then we also hosted it on npm.
[00:09:41] [speaker-0] So what you tend to see in the industry is that some people will host the script privately,
[00:09:47] [speaker-0] say on an S3 bucket.
[00:09:49] [speaker-0] That's cached.
[00:09:50] [speaker-0] You see that with Cani
[00:09:51] [speaker-0] Intercom.
[00:09:52] [speaker-0] And then you have the other route that is basically using a CDN,
[00:09:57] [speaker-0] an npm CDN.
[00:09:58] [speaker-0] And have you ever used one of these npm CDNs?
[00:10:01] [speaker-1] Yeah,
[00:10:02] [speaker-1] just a couple times,
[00:10:03] [speaker-1] like unpackage.
[00:10:04] [speaker-1] There's actually there's an Ecmascript one in particular,
[00:10:07] [speaker-1] ESM.sh.
[00:10:08] [speaker-1] I think they're good for like really simple demos,
[00:10:10] [speaker-1] or you want to do something like a code sandbox,
[00:10:12] [speaker-1] and you want to pull something without having a build step.
[00:10:15] [speaker-0] Yeah,
[00:10:15] [speaker-0] and this is actually really weird because I feel like we're in between like multiple ways of doing JavaScript.
[00:10:21] [speaker-0] I
[00:10:22] [speaker-0] You could just npm install,
[00:10:24] [speaker-0] or you could just load the script in the browser.
[00:10:27] [speaker-0] What is the better way?
[00:10:29] [speaker-0] This is actually a really interesting one because as somebody building a script,
[00:10:33] [speaker-0] you could do either for ever fun.
[00:10:34] [speaker-0] You could install it as an npm package and import it,
[00:10:38] [speaker-0] or you could just run it from the cloud using the UMD file.
[00:10:42] [speaker-0] And actually,
[00:10:43] [speaker-0] you'd be better to import it into your JavaScript bundle because it would be smaller because using the Common JS bundle,
[00:10:50] [speaker-0] not
[00:10:50] [speaker-0] The UMD bundle.
[00:10:52] [speaker-1] So,
[00:10:52] [speaker-1] what's stopping you from just taking all of the code and just like literally copy pasting it into the script tag on your website?
[00:10:58] [speaker-0] That's an interesting one.
[00:10:59] [speaker-0] What's stopping you?
[00:11:00] [speaker-0] I don't think there is anything.
[00:11:02] [speaker-0] Because if it's in UMD,
[00:11:03] [speaker-0] it should technically all run because it's in a format it should work.
[00:11:06] [speaker-0] But you'll then have a really big script that you've got to then share to people and be like,
[00:11:11] [speaker-0] "Hey,
[00:11:11] [speaker-0] install this 200 line,
[00:11:13] [speaker-0] 300 line script into your website.
[00:11:15] [speaker-0] It's fine."
[00:11:16] [speaker-0] And that's actually the hardest point.
[00:11:18] [speaker-0] What we're doing with all this is trying to create the best developer experience.
[00:11:22] [speaker-0] I want to plug and play.
[00:11:23] [speaker-0] I want to get a chat widget onto my website.
[00:11:26] [speaker-0] What is in your eyes the most easiest way to get it onto the website is that?
[00:11:31] [speaker-0] NPM installing it into your React packet into your React website,
[00:11:34] [speaker-0] and then doing a like a JSX component is that loading it with a hook,
[00:11:40] [speaker-0] is that importing it through HTML and a script tag.
[00:11:44] [speaker-0] This is a really weird thing because there's so many ways to get the same functionality.
[00:11:48] [speaker-0] The next really big thing about it all that I think is actually quite confusing is why do we do it this way?
[00:11:54] [speaker-0] So what I mean by that is we spoke about the problems.
[00:11:58] [speaker-0] I want to be like a verbal tutorial at the same time.
[00:12:00] [speaker-0] You know what I mean?
[00:12:01] [speaker-0] Of like,
[00:12:02] [speaker-0] how do you do all these things?
[00:12:04] [speaker-1] Sure.
[00:12:04] [speaker-1] You really want to?
[00:12:05] [speaker-0] I want to give like a compelling episode that talks about this area of like darkness that I've actually like struggled with.
[00:12:12] [speaker-0] But how do you actually make it compelling?
[00:12:14] [speaker-0] You know what I mean?
[00:12:15] [speaker-1] Oh,
[00:12:15] [speaker-1] I'm already compelled.
[00:12:16] [speaker-0] You're compelled.
[00:12:17] [speaker-0] Okay.
[00:12:18] [speaker-0] Okay.
[00:12:18] [speaker-0] This is actually something worth saying.
[00:12:20] [speaker-0] So,
[00:12:20] [speaker-0] this is actually really interesting.
[00:12:22] [speaker-0] Moment to also talk about is that you've made your script now.
[00:12:25] [speaker-0] How do you demonstrate that?
[00:12:27] [speaker-0] Are you just going to give your customers a
[00:12:29] [speaker-0] HTML version?
[00:12:31] [speaker-0] So saying,
[00:12:31] [speaker-0] install it from the CDN.
[00:12:33] [speaker-0] Go.
[00:12:33] [speaker-0] That's one way.
[00:12:34] [speaker-0] And then,
[00:12:35] [speaker-0] how about installing into React?
[00:12:36] [speaker-0] React is also totally different in every way that it works with everything.
[00:12:41] [speaker-0] And what we've found with Everfund is that we've created two SDKs.
[00:12:45] [speaker-0] We've created a JavaScript SDK that is core JS,
[00:12:49] [speaker-0] and then we've created a React SDK that hooks into React.
[00:12:52] [speaker-0] We speak so much about the differences in frameworks.
[00:12:55] [speaker-0] About a virtual DOM.
[00:12:57] [speaker-0] Yep,
[00:12:57] [speaker-0] React does everything differently,
[00:12:59] [speaker-0] so we have to use the virtual DOM.
[00:13:01] [speaker-0] And what we actually find is the Common JS library,
[00:13:04] [speaker-0] the JavaScript SDK,
[00:13:06] [speaker-0] is only about I think two thousand kilobytes.
[00:13:09] [speaker-0] The React version is like four,
[00:13:11] [speaker-0] five,
[00:13:12] [speaker-0] six megabytes.
[00:13:13] [speaker-0] I think so much,
[00:13:14] [speaker-0] much bigger.
[00:13:15] [speaker-0] Off the top of my head,
[00:13:16] [speaker-0] I'm terrible with numbers,
[00:13:17] [speaker-0] as we all know.
[00:13:18] [speaker-0] But this is actually where I've been talking about in the past about learning experiences with other frameworks.
[00:13:24] [speaker-0] How do you then get your script into another framework?
[00:13:27] [speaker-0] So,
[00:13:27] [speaker-0] say Vue or Svelte.
[00:13:29] [speaker-0] It's actually quite easy,
[00:13:30] [speaker-0] and it's surprisingly simple.
[00:13:34] [speaker-1] Yeah,
[00:13:34] [speaker-1] because they just have script tags,
[00:13:36] [speaker-1] and they pretty much just function like HTML pages would,
[00:13:39] [speaker-1] unlike React.
[00:13:40] [speaker-0] Exactly.
[00:13:41] [speaker-0] You just install it,
[00:13:42] [speaker-0] and then you bind it to a function,
[00:13:44] [speaker-0] and it's done.
[00:13:45] [speaker-0] This was actually kind of crazy,
[00:13:46] [speaker-0] and it's speaking about the web as a whole,
[00:13:48] [speaker-0] as in like when you're building something for your customers.
[00:13:52] [speaker-0] So it's not an
[00:13:53] [speaker-0] Experience that you control,
[00:13:55] [speaker-0] let's say,
[00:13:55] [speaker-0] like a dashboard,
[00:13:56] [speaker-0] but something to go on their website.
[00:13:58] [speaker-0] You've got to kind of like mold everything that won't get overridden,
[00:14:02] [speaker-0] i.e.,
[00:14:03] [speaker-0] encapsulated,
[00:14:04] [speaker-0] i.e.,
[00:14:04] [speaker-0] CSS functions,
[00:14:06] [speaker-0] variables.
[00:14:07] [speaker-0] You then need to make sure that it can be imported into frameworks of choice in the best way possible.
[00:14:14] [speaker-0] You also then need to make sure you have like a UMD version that could be imported into things like WordPress websites,
[00:14:21] [speaker-0] websites that don't use a lot of JavaScript.
[00:14:23] [speaker-0] And all this starts to look like a really big puzzle.
[00:14:26] [speaker-0] On how do you actually do it?
[00:14:28] [speaker-0] The first step,
[00:14:29] [speaker-0] how we did it in Everfund,
[00:14:31] [speaker-0] is we wrote a class with a new,
[00:14:33] [speaker-0] so new class.
[00:14:34] [speaker-0] What that has is every single option that we wanted to run inside of it,
[00:14:39] [speaker-0] such as watching a
[00:14:41] [speaker-0] ID click.
[00:14:43] [speaker-0] So for a button,
[00:14:44] [speaker-0] say if you put an ID of like open pop up,
[00:14:47] [speaker-0] we'd watch that ID when it gets clicked.
[00:14:49] [speaker-0] We would then hijack that click and run all of our custom functionality.
[00:14:53] [speaker-0] That was necessarily quite easy,
[00:14:55] [speaker-0] but actually the hard part that actually took longer was working out the CSS solution.
[00:15:00] [speaker-0] Before I speak about CSS solution,
[00:15:02] [speaker-0] if you were to inject,
[00:15:03] [speaker-0] say,
[00:15:03] [speaker-0] some code onto another website,
[00:15:05] [speaker-0] how would you think about doing it?
[00:15:07] [speaker-0] I,
[00:15:07] [speaker-0] you're going to run,
[00:15:08] [speaker-0] say,
[00:15:09] [speaker-0] a form.
[00:15:10] [speaker-0] We'll make it easy,
[00:15:11] [speaker-0] a form.
[00:15:11] [speaker-0] How would you inject a form onto a website?
[00:15:15] [speaker-1] You use Netlify forms.
[00:15:16] [speaker-0] So you're going to use Netlify forms.
[00:15:17] [speaker-0] So you're going to load an iframe,
[00:15:20] [speaker-0] and this is actually really interesting.
[00:15:21] [speaker-0] What is the better strategy?
[00:15:23] [speaker-0] Do you build the form out of HTML on the web page,
[00:15:27] [speaker-0] so you're actually building into the DOM,
[00:15:30] [speaker-0] or do you iframe?
[00:15:32] [speaker-0] Tarshan at
[00:15:33] [speaker-0] User Vitals has done the opposite to me,
[00:15:37] [speaker-0] I believe.
[00:15:38] [speaker-0] So in my web app,
[00:15:39] [speaker-0] we use iframes; it loads our Next.js website,
[00:15:43] [speaker-0] but Tarshan's User Vitals,
[00:15:46] [speaker-0] I believe,
[00:15:47] [speaker-0] builds the actual content into the web page.
[00:15:50] [speaker-0] So you have multiple more complexes until Portals comes out.
[00:15:54] [speaker-0] Until Portals,
[00:15:55] [speaker-0] this is also the savior of everything.
[00:15:57] [speaker-0] Portals,
[00:15:58] [speaker-0] whenever that will be,
[00:15:59] [speaker-1] and check out episode nine for more on Portals.
[00:16:02] [speaker-0] The biggest problem to this is communication to your server.
[00:16:06] [speaker-0] So,
[00:16:06] [speaker-0] say if you're going to send an API call,
[00:16:08] [speaker-0] it could be CORS blocked if you use the method built into the website's DOM because you are then sending a web call from that URL.
[00:16:18] [speaker-0] If that makes sense,
[00:16:19] [speaker-0] but if it's an iframe,
[00:16:21] [speaker-0] it doesn't get CORS blocked because it's working inside that website.
[00:16:25] [speaker-0] So,
[00:16:25] [speaker-0] what's the pros and cons to each?
[00:16:27] [speaker-0] When it's an iframe,
[00:16:28] [speaker-0] you tend to have a lot less.
[00:16:30] [speaker-0] Of a JavaScript bundle,
[00:16:32] [speaker-0] i.e.,
[00:16:33] [speaker-0] what you're building,
[00:16:33] [speaker-0] because really,
[00:16:34] [speaker-0] what you're then building in your script is a way to put an iframe on the page,
[00:16:39] [speaker-0] open it,
[00:16:40] [speaker-0] and let the website inside render.
[00:16:42] [speaker-0] And that's actually,
[00:16:43] [speaker-0] you know,
[00:16:43] [speaker-0] good enough for most use cases.
[00:16:45] [speaker-0] And it was in Everfund's donation widget.
[00:16:47] [speaker-0] So,
[00:16:48] [speaker-0] what do you gain,
[00:16:49] [speaker-0] and what do you lose?
[00:16:50] [speaker-0] What you gain is that you control the website.
[00:16:54] [speaker-0] Every time the website changes,
[00:16:55] [speaker-0] you don't have to push a new version of the script.
[00:16:58] [speaker-0] Publicly,
[00:16:59] [speaker-0] you just update the website because you know the loader doesn't change.
[00:17:02] [speaker-0] But then,
[00:17:03] [speaker-0] if a user wants to customize,
[00:17:05] [speaker-0] say,
[00:17:06] [speaker-0] CSS on how that form was going to look,
[00:17:10] [speaker-0] then it's going to be impossible because you can't edit CSS inside an iframe.
[00:17:15] [speaker-0] That's when you would then have to put CSS like a CSS import into your website that could then allow them to inject their own CSS.
[00:17:24] [speaker-0] So you see that there's.
[00:17:26] [speaker-0] It's not an easy picture,
[00:17:27] [speaker-0] no matter what you pick,
[00:17:28] [speaker-0] and providing a really good experience is really,
[00:17:32] [speaker-0] really hard.
[00:17:33] [speaker-1] So,
[00:17:33] [speaker-1] why is there not a startup trying to fix this problem?
[00:17:37] [speaker-0] Interesting.
[00:17:37] [speaker-0] Why is there not a startup?
[00:17:38] [speaker-0] Because it's kind of like half web standards,
[00:17:41] [speaker-0] I think.
[00:17:41] [speaker-0] But also,
[00:17:42] [speaker-0] do we all know the correct abstraction?
[00:17:45] [speaker-0] Is there a correct abstraction?
[00:17:46] [speaker-0] We also kind of maybe seen this in other people's work as well.
[00:17:51] [speaker-0] We recently had.
[00:17:53] [speaker-0] A person on from Quick yesterday,
[00:17:55] [speaker-0] and he was saying that he is building a language that can compile to any language,
[00:18:00] [speaker-0] i.e.,
[00:18:00] [speaker-0] to web and all these other things.
[00:18:03] [speaker-0] Depending on the framework,
[00:18:04] [speaker-0] there's all these aspects that out there as like multiple deployment targets.
[00:18:09] [speaker-0] But actually,
[00:18:09] [speaker-0] doing it,
[00:18:10] [speaker-0] maybe a SaaS startup is too much,
[00:18:12] [speaker-0] and it's actually we should just have a really good starter that's really highly starred on GitHub that everybody just uses.
[00:18:20] [speaker-1] Sounds like.
[00:18:21] [speaker-1] Something you can do after all this stuff you've done,
[00:18:23] [speaker-0] potentially yes.
[00:18:25] [speaker-0] Everfund's donation widget is not actually done.
[00:18:27] [speaker-0] Our SDK,
[00:18:28] [speaker-0] we're actually just starting our SDK.
[00:18:30] [speaker-0] Our SDK today is just opening our donation widget in an iframe.
[00:18:34] [speaker-0] But what we're moving to right now and what we're building on is extending that into a headless donation system.
[00:18:40] [speaker-0] So that then will allow anybody to completely build their own UI on top of all of our functionality.
[00:18:47] [speaker-0] And then what we've turned our SDK into is this script that.
[00:18:50] [speaker-0] One loads your script.
[00:18:52] [speaker-0] Two initializes classes that will then be allow you to create and take donations for charities in a headless way.
[00:19:00] [speaker-0] And what that involves is extending the classes functions to then do REST calls as well.
[00:19:06] [speaker-0] Not too hard.
[00:19:08] [speaker-0] The big thing about all this is that they're very core functions.
[00:19:12] [speaker-0] I,
[00:19:12] [speaker-0] you know,
[00:19:12] [speaker-0] I might do a REST call on an API call or load an iframe.
[00:19:16] [speaker-0] But the way Web Standards is,
[00:19:18] [speaker-0] it
[00:19:19] [speaker-0] All can get really muddy really fast because there's so many ways of doing anything.
[00:19:24] [speaker-0] If that makes sense,
[00:19:25] [speaker-0] like what's the right way?
[00:19:26] [speaker-0] What's the right way to create a script?
[00:19:28] [speaker-0] This is a really good question.
[00:19:30] [speaker-0] Where would I say start?
[00:19:31] [speaker-0] I would be nice,
[00:19:32] [speaker-0] and I'd say probably go look at Everfund's JavaScript SDK because we actually open source it,
[00:19:38] [speaker-0] so you could bundle it yourself.
[00:19:40] [speaker-0] And then,
[00:19:40] [speaker-0] second,
[00:19:41] [speaker-0] we've made loads of examples that has it bundled in,
[00:19:43] [speaker-0] so you can actually try it and then build one for yourself off of it.
[00:19:47] [speaker-0] That's what I'd say would be a great first step.
[00:19:49] [speaker-0] Is because I've gone through a lot of headaches getting that to this point that it actually bundles and works on every single browser,
[00:19:57] [speaker-0] every single web platform.
[00:19:59] [speaker-0] We had problems where our
[00:20:01] [speaker-0] Donation widget just would not work on WordPress.
[00:20:05] [speaker-0] The code would be there,
[00:20:06] [speaker-0] the script tag would be in the page,
[00:20:08] [speaker-0] and it just wouldn't work.
[00:20:09] [speaker-0] And we was like,
[00:20:10] [speaker-0] "Is this a JavaScript problem?
[00:20:11] [speaker-0] Is this a
[00:20:12] [speaker-0] WordPress problem?"
[00:20:13] [speaker-0] You know,
[00:20:14] [speaker-0] you're looking at the code,
[00:20:14] [speaker-0] and what made it weirder is that it worked on some WordPress websites but not others.
[00:20:19] [speaker-0] And you're like,
[00:20:20] [speaker-0] "Why is it doing that?"
[00:20:21] [speaker-1] Because there's different versions of WordPress,
[00:20:23] [speaker-1] and some people let their WordPress sit forever and never update it,
[00:20:27] [speaker-1] and other people are like,
[00:20:28] [speaker-1] "Well,
[00:20:28] [speaker-1] I need to update it because it has nine vulnerabilities in it now."
[00:20:30] [speaker-1] and
[00:20:31] [speaker-1] That's why you're going to have a huge spread of different types of WordPress sites.
[00:20:35] [speaker-0] Yeah,
[00:20:35] [speaker-0] this was the latest version of WordPress,
[00:20:38] [speaker-0] so almost identical websites.
[00:20:40] [speaker-0] The solution to this was actually not to call a JavaScript CDN,
[00:20:46] [speaker-0] but to host the script inside the WordPress instance.
[00:20:50] [speaker-0] It almost was like the WordPress instance was blocking the script communicating with the web.
[00:20:56] [speaker-0] It was really weird edge case that we managed to solve by.
[00:21:00] [speaker-0] Bundling the script inside the WordPress tag.
[00:21:02] [speaker-0] Really,
[00:21:03] [speaker-0] you could say this was a real twenty twenty five minute ramble.
[00:21:06] [speaker-0] There is also other subjects that I did want to talk about in this episode for sure.
[00:21:10] [speaker-0] Where do you go and how do you start and what to do?
[00:21:14] [speaker-0] Because I think so far the evolution of FS Jam has been.
[00:21:19] [speaker-0] We've been speaking to so many frameworks advocates,
[00:21:24] [speaker-0] and we love doing all them things,
[00:21:26] [speaker-0] but.
[00:21:27] [speaker-0] Me and Anthony also love to chat to each other and just talk about technology.
[00:21:31] [speaker-0] I feel like we need another deep dive without a guest to talk about the blockchain again.
[00:21:37] [speaker-0] Now that you work at a Web three company,
[00:21:39] [speaker-0] just really trying to explain it,
[00:21:40] [speaker-0] really try and make it easy.
[00:21:42] [speaker-0] Not necessarily every episode is going to now just be me and Anthony,
[00:21:46] [speaker-0] but I think it'll be great once in a while to try start exploring other subjects.
[00:21:50] [speaker-0] Let other people maybe learn from these subjects.
[00:21:53] [speaker-0] You know,
[00:21:53] [speaker-0] if there's a subject you want us to talk about.
[00:21:55] [speaker-0] Potentially at Asgard.
[00:21:56] [speaker-0] Another good subject,
[00:21:57] [speaker-0] I think,
[00:21:58] [speaker-0] to talk about.
[00:21:59] [speaker-0] This can be just ourselves,
[00:22:00] [speaker-0] or it could be someone else with us.
[00:22:01] [speaker-0] Is documentation?
[00:22:03] [speaker-0] You've wrote a lot of documentation,
[00:22:04] [speaker-0] but how do you write good documentation?
[00:22:07] [speaker-1] Oh God,
[00:22:08] [speaker-1] yeah,
[00:22:08] [speaker-1] that's a huge one.
[00:22:09] [speaker-0] Exactly.
[00:22:10] [speaker-0] Say you're a SaaS product.
[00:22:11] [speaker-0] You wrote your SDK that we've just been speaking about,
[00:22:14] [speaker-0] and now you need to document it.
[00:22:16] [speaker-0] How do you document it well?
[00:22:18] [speaker-0] We've had Docosaurus on.
[00:22:20] [speaker-0] We've had Tana Lindsay on.
[00:22:22] [speaker-0] These two people build really good documentation.
[00:22:25] [speaker-0] Separately,
[00:22:26] [speaker-0] a Docker source builds the website.
[00:22:27] [speaker-0] Tanner Lindsay built his own.
[00:22:29] [speaker-0] But actually,
[00:22:30] [speaker-0] how do you write really good documentation?
[00:22:32] [speaker-0] And actually,
[00:22:33] [speaker-0] how do you get people to understand it?
[00:22:34] [speaker-0] That's one thing I want to sit down and really ask you one day.
[00:22:38] [speaker-1] I agree,
[00:22:39] [speaker-1] and it's something that there's no docs specification,
[00:22:41] [speaker-1] but there is a docs system,
[00:22:44] [speaker-1] Divio,
[00:22:44] [speaker-1] I think it is.
[00:22:45] [speaker-1] They break it down to tutorials,
[00:22:49] [speaker-1] explanation,
[00:22:50] [speaker-1] reference,
[00:22:51] [speaker-1] and how tos.
[00:22:52] [speaker-1] And I remember I came up with kind of my.
[00:22:54] [speaker-1] Slightly different namings for this because I think that tutorials and how tos sounds like the same thing to people,
[00:22:59] [speaker-1] so that's a little confusing.
[00:23:00] [speaker-1] The main thing is that like you'll have a reference would just be like an API reference,
[00:23:04] [speaker-1] so you have like every single method you can call,
[00:23:06] [speaker-1] and then everything that it takes,
[00:23:07] [speaker-1] and it's just like pure information.
[00:23:09] [speaker-1] And then you have explanation would be like this:
[00:23:12] [speaker-1] what we're doing here in a podcast,
[00:23:13] [speaker-1] like explaining something,
[00:23:14] [speaker-1] just kind of in like prose or normal language,
[00:23:18] [speaker-1] maybe with or without some code examples.
[00:23:20] [speaker-1] And then how to guide would be
[00:23:23] [speaker-1] How to do something specific.
[00:23:25] [speaker-1] So,
[00:23:25] [speaker-1] like for Redwood,
[00:23:26] [speaker-1] this would be like how do you connect Redwood to file storage,
[00:23:29] [speaker-1] or how do you make a third-party API call?
[00:23:31] [speaker-1] And then tutorial is something that is meant to teach you something as you go throughout the process.
[00:23:38] [speaker-1] So,
[00:23:39] [speaker-1] like the Redwood tutorial,
[00:23:40] [speaker-1] at the end you don't really have like a quote-unquote production app that really does anything that fancy,
[00:23:45] [speaker-1] but it gets you to understand the entire framework along the way.
[00:23:49] [speaker-1] So,
[00:23:49] [speaker-1] I think that's a pretty good way to separate the different types of
[00:23:52] [speaker-1] Documentation you can write,
[00:23:54] [speaker-1] and then you want to make sure those categories are then easily represented on your actual doc site,
[00:24:01] [speaker-1] so people then can navigate and know how to find things.
[00:24:04] [speaker-0] Yeah,
[00:24:04] [speaker-0] documentation is,
[00:24:06] [speaker-0] as you just said,
[00:24:06] [speaker-0] it's this really,
[00:24:07] [speaker-0] really big thing.
[00:24:08] [speaker-0] And at Everfund,
[00:24:09] [speaker-0] we tried Docasaurus,
[00:24:11] [speaker-0] we tried rolling our own solution,
[00:24:13] [speaker-0] but now we're actually using ReadMe.
[00:24:15] [speaker-0] Have you heard of ReadMe?
[00:24:17] [speaker-0] ReadMe.io.
[00:24:18] [speaker-1] I've heard of it.
[00:24:18] [speaker-1] I know there's like there's GitBook.
[00:24:20] [speaker-1] Also,
[00:24:21] [speaker-1] there's there's a lot of these.
[00:24:22] [speaker-1] I have not used ReadMe myself,
[00:24:24] [speaker-1] but I think it's one that if I saw it,
[00:24:25] [speaker-1] I would recognize like the look because I read so much documentation.
[00:24:29] [speaker-0] Yes.
[00:24:29] [speaker-0] Well,
[00:24:29] [speaker-0] we're we're using it with Everfund.
[00:24:31] [speaker-0] This is actually some.
[00:24:31] [speaker-0] Something that I think is super,
[00:24:33] [speaker-0] super important is like with that we're building a open REST API for Everfund as well,
[00:24:38] [speaker-0] so that's built into the documentation.
[00:24:40] [speaker-0] And finding a documentation platform that makes the
[00:24:44] [speaker-0] REST API documentation look as good as the actual rest of the documentation is something by itself.
[00:24:51] [speaker-0] I think the real top level of documentation is Stripe.
[00:24:54] [speaker-0] We could all want to be like Stripe,
[00:24:55] [speaker-0] but they obviously spend a lot of money being like that.
[00:24:58] [speaker-0] There's so many subject areas that.
[00:25:00] [speaker-0] We always want to talk about and getting round to them is a really big question.
[00:25:06] [speaker-0] Something that we have coming up,
[00:25:08] [speaker-0] we're both going to
[00:25:09] [speaker-0] Utah for Remix Conference.
[00:25:12] [speaker-0] How are you feeling about that,
[00:25:13] [speaker-0] Anthony?
[00:25:13] [speaker-1] I'm stoked.
[00:25:14] [speaker-1] Yeah,
[00:25:14] [speaker-1] there's going to be a lot of people there that I know,
[00:25:17] [speaker-1] Michael Chan,
[00:25:18] [speaker-1] Ishan,
[00:25:19] [speaker-1] both which have been on the show,
[00:25:21] [speaker-1] and then Austin Krim,
[00:25:22] [speaker-1] who works at Prisma.
[00:25:23] [speaker-1] We'll be hanging out with him for a bit.
[00:25:25] [speaker-1] Some other people as well.
[00:25:27] [speaker-1] Yeah,
[00:25:27] [speaker-1] so I'm looking forward to it.
[00:25:29] [speaker-1] I am.
[00:25:30] [speaker-1] Not going to be speaking.
[00:25:32] [speaker-1] I won't be like really doing much "quote unquote"
[00:25:34] [speaker-1] like work stuff.
[00:25:35] [speaker-1] It won't be a really like work conference for me.
[00:25:38] [speaker-1] So yeah,
[00:25:38] [speaker-1] I think it'll be fun.
[00:25:39] [speaker-1] And then my girlfriend's going to be there as well.
[00:25:41] [speaker-1] So Jen will get to meet a lot of my friends,
[00:25:43] [speaker-1] which will be cool.
[00:25:44] [speaker-1] We get to meet her.
[00:25:45] [speaker-0] That'd be very cool.
[00:25:46] [speaker-0] My partner is very jealous that I'm going to the United States.
[00:25:49] [speaker-0] I'm sadly taking my business partner instead of my actual partner,
[00:25:54] [speaker-0] but she's going away to a five-star resort in Greece instead.
[00:25:58] [speaker-0] So I'm sure she's not missing out that much.
[00:26:01] [speaker-0] Something else that I quickly wanted to talk about on air is how we feel about the podcast,
[00:26:08] [speaker-0] where it's going,
[00:26:09] [speaker-0] and also how we feel about always having guests on.
[00:26:12] [speaker-0] I've not broached this conversation with you before having this conversation,
[00:26:16] [speaker-0] but I think it's actually quite cool to have it very open,
[00:26:19] [speaker-0] very you know,
[00:26:20] [speaker-0] have your thoughts in the air.
[00:26:22] [speaker-1] Yeah,
[00:26:22] [speaker-1] we enjoy these episodes.
[00:26:23] [speaker-1] I was saying the last time we did this that I wish we did these.
[00:26:26] [speaker-1] More often,
[00:26:27] [speaker-1] so yeah,
[00:26:27] [speaker-1] I can see us doing this maybe like once every other month or something like that,
[00:26:31] [speaker-1] and then get a good cadence.
[00:26:32] [speaker-1] Because the main thing is just like there's so many guests that we would like to have on,
[00:26:36] [speaker-1] so we always want to like keep space for them.
[00:26:38] [speaker-1] And then I think listeners will get value from our conversations,
[00:26:42] [speaker-1] but they'll also get a lot of value from being exposed to new projects and new people and their ideas.
[00:26:48] [speaker-1] Because if you've been listening to us for a while,
[00:26:50] [speaker-1] you probably will know our opinions about a lot of things at this point,
[00:26:54] [speaker-1] but there is still stuff that I think that.
[00:26:55] [speaker-1] We could probably talk about that we haven't really dove into too much,
[00:26:59] [speaker-1] but yeah.
[00:26:59] [speaker-1] And then I think something else that you probably were getting to here is that we're considering sponsors for the first time,
[00:27:05] [speaker-1] and so it's likely that we'll be bringing on some different companies and having just a short little ad read in the beginning of the show that you're welcome to skip if you want,
[00:27:14] [speaker-1] but it's going to really make this a lot more sustainable for us because it's something that we've been both doing as a labor of love,
[00:27:22] [speaker-1] really.
[00:27:22] [speaker-1] Myself especially put in quite a few hours each week on it to make it happen,
[00:27:26] [speaker-1] so that is something that I have hesitated to do.
[00:27:30] [speaker-1] But I think as long as there are companies that
[00:27:32] [speaker-1] I feel confident promoting,
[00:27:34] [speaker-1] then I think I won't feel too bad about it.
[00:27:37] [speaker-1] And then listeners can skip it if they want.
[00:27:39] [speaker-1] It's very easy to fast forward commercials in podcasts.
[00:27:42] [speaker-1] So yeah,
[00:27:42] [speaker-1] if people have any ideas of who we should sponsor or anything like that,
[00:27:46] [speaker-1] feel free to shoot us a message on Twitter and let us know.
[00:27:49] [speaker-1] Those will likely be coming in the.
[00:27:52] [speaker-1] Next couple weeks or a month,
[00:27:53] [speaker-0] yeah.
[00:27:53] [speaker-0] And this is something that I wanted to ask:
[00:27:56] [speaker-0] What's your opinion on having products frameworks on the podcast that you could openly endorse?
[00:28:04] [speaker-0] Are the episodes we have where one of us is so far deep in the area almost alienating?
[00:28:11] [speaker-0] If that makes sense,
[00:28:12] [speaker-0] so what I mean is,
[00:28:14] [speaker-0] let's take an area,
[00:28:15] [speaker-0] something that we're both really,
[00:28:16] [speaker-0] really knowledgeable at,
[00:28:17] [speaker-0] and say Redwood.
[00:28:19] [speaker-0] So if you listen to our episodes about redwood,
[00:28:21] [speaker-0] we say it's the best thing ever.
[00:28:22] [speaker-0] You're never gonna have a problem,
[00:28:24] [speaker-0] and you know you should go out today and you should build in redwood.
[00:28:26] [speaker-1] We don't say that.
[00:28:27] [speaker-1] I specifically don't say because I'm a responsible advocate,
[00:28:30] [speaker-1] and I would never say that.
[00:28:31] [speaker-0] Responsible advocacy—that's more what I'm trying to guess at—is when it comes to sponsorships,
[00:28:37] [speaker-0] when it comes to people who are coming onto the podcast.
[00:28:40] [speaker-0] Developer advocacy is a lot of the people we get on,
[00:28:44] [speaker-0] and yes,
[00:28:45] [speaker-0] they are trying to get you to understand their product.
[00:28:48] [speaker-0] Understand what they're doing,
[00:28:50] [speaker-0] and also give some value.
[00:28:51] [speaker-0] So,
[00:28:52] [speaker-0] as a developer advocate yourself,
[00:28:53] [speaker-0] we kind of sit on both ends.
[00:28:55] [speaker-0] I'm a founder of a company.
[00:28:56] [speaker-0] You're a developer advocate.
[00:28:57] [speaker-0] How do you feel about almost having these episodes being,
[00:29:01] [speaker-0] you know,
[00:29:01] [speaker-0] pitches?
[00:29:02] [speaker-0] All these guest episodes are they pitches in your eyes,
[00:29:06] [speaker-0] or are they?
[00:29:06] [speaker-0] You want to learn something without necessarily buying the product?
[00:29:10] [speaker-1] So,
[00:29:10] [speaker-1] if you're doing DevRel correctly.
[00:29:13] [speaker-1] You are always educating first,
[00:29:15] [speaker-1] and then the awareness is downstream of the education.
[00:29:18] [speaker-1] So that's why the types of advocates that I bring on to this show—they are always going to be associated with a framework or a product or something that they are there to talk about.
[00:29:28] [speaker-1] That's the whole point.
[00:29:28] [speaker-1] We have an episode about a subject,
[00:29:30] [speaker-1] usually not about a person.
[00:29:32] [speaker-1] But if they actually are trying to lift up the developer community and not just shill their thing.
[00:29:39] [speaker-1] Then the episode will still be valuable.
[00:29:41] [speaker-1] So for me,
[00:29:42] [speaker-1] I haven't had much problems with this because I have had a pretty good handle on who are the advocates out there and who could we invite on.
[00:29:50] [speaker-1] Because many of the people we've had on the show,
[00:29:51] [speaker-1] I've listened to them do like ten podcasts before,
[00:29:54] [speaker-1] you know.
[00:29:54] [speaker-1] So I had a pretty good idea of who I would feel comfortable bringing on,
[00:29:59] [speaker-1] and most of the
[00:30:00] [speaker-0] You know,
[00:30:00] [speaker-0] were things that I'd already used or at least tried or felt pretty confident about.
[00:30:04] [speaker-0] I think I've had a fairly good track record on that for the most part,
[00:30:08] [speaker-0] and I feel good about the sum total of both guests here and stuff I've written about.
[00:30:13] [speaker-0] The only thing I can think of that I really regret having ever promoted and like actually deleted my blog post by it because like I don't want anyone to like read this and find this is Quivery.
[00:30:24] [speaker-0] I will officially renounce Quivery because their platform is completely broken.
[00:30:28] [speaker-0] They have no support.
[00:30:29] [speaker-0] And then they basically put you in a position where you have like a hundred dollar Kubernetes bill,
[00:30:32] [speaker-0] and you have no idea what to do.
[00:30:34] [speaker-0] It's a nightmare.
[00:30:35] [speaker-0] Do not ever use it.
[00:30:36] [speaker-1] And that's the thing of as we just spoke about making the podcast more sustainable.
[00:30:41] [speaker-1] When it comes to advertisements,
[00:30:43] [speaker-1] should every word come out of our mouth be believed?
[00:30:46] [speaker-1] To get a podcast advertisement on,
[00:30:49] [speaker-1] should we have used the product?
[00:30:51] [speaker-1] Should we know the product,
[00:30:52] [speaker-1] or is it okay to just recommend the product from a podcast?
[00:30:56] [speaker-1] These are bigger questions that I think just our podcast and many podcast hosts have these kind of questions.
[00:31:02] [speaker-1] But what's your thoughts on that?
[00:31:03] [speaker-1] I somebody comes along,
[00:31:05] [speaker-1] you've never heard of their tech company.
[00:31:07] [speaker-1] Well,
[00:31:08] [speaker-1] you've heard of it,
[00:31:08] [speaker-1] but you've never used it yourself.
[00:31:10] [speaker-1] And they're like,
[00:31:11] [speaker-1] "Will give you some money?
[00:31:12] [speaker-1] You go give us your listeners."
[00:31:14] [speaker-1] How does that feel to you?
[00:31:15] [speaker-0] Yeah,
[00:31:16] [speaker-0] and this is something that comes up significantly more in the blockchain Web three world because there's so much money floating around.
[00:31:21] [speaker-0] People want to get their stuff out there so much,
[00:31:23] [speaker-0] so.
[00:31:24] [speaker-0] The question of trust is huge here,
[00:31:26] [speaker-0] and how do you know whether to trust someone?
[00:31:29] [speaker-0] How do you signal trust?
[00:31:31] [speaker-0] And for me,
[00:31:32] [speaker-0] because I already going back to last thing I said,
[00:31:34] [speaker-0] I already knew the ecosystem really well,
[00:31:35] [speaker-0] so I already had a good handle on who to trust.
[00:31:38] [speaker-0] But then,
[00:31:38] [speaker-0] if anyone ever came to us who we'd never heard of,
[00:31:41] [speaker-0] usually I would just you know talk to them for a little bit,
[00:31:43] [speaker-0] and then I would check out their product.
[00:31:45] [speaker-0] If they had other material,
[00:31:46] [speaker-0] I would check that out,
[00:31:47] [speaker-0] and usually I'd get a sense just from kind of chatting with people.
[00:31:50] [speaker-0] Whether they knew what they were talking about,
[00:31:51] [speaker-0] if they were going to be a good guest,
[00:31:53] [speaker-0] like Jake Ginnivan is a good example here.
[00:31:55] [speaker-0] Like I'd never heard of Jake's product; it was a you know the feature flag one,
[00:31:59] [speaker-0] and he just kind of messaged me out of the blue on the Jamstack Slack,
[00:32:03] [speaker-0] rest in peace.
[00:32:04] [speaker-0] And he was just like saying,
[00:32:05] [speaker-0] "Yeah,
[00:32:05] [speaker-0] I really like the podcast."
[00:32:06] [speaker-0] He was like talking me about,
[00:32:07] [speaker-0] and he was talking about his past and how he did all this like SSR stuff for this you know like Australian news company.
[00:32:12] [speaker-0] And very quickly,
[00:32:13] [speaker-0] I was like,
[00:32:13] [speaker-0] "All right,
[00:32:14] [speaker-0] this dude like knows what he's talking about.
[00:32:15] [speaker-0] This guy's a very very experienced engineer."
[00:32:17] [speaker-0] So yeah,
[00:32:18] [speaker-0] you just gotta like take enough time.
[00:32:20] [speaker-0] To actually like vet someone and just like do a gut check on someone,
[00:32:24] [speaker-0] if you are already experienced and you know what to look for and you know the telltale signs,
[00:32:29] [speaker-0] that shouldn't take you too long.
[00:32:31] [speaker-0] But you gotta do at least some kind of baseline level of vetting before you just like let anyone come on your podcast.
[00:32:37] [speaker-0] And then that's partly what our job is to make sure we don't just bring anyone onto the podcast,
[00:32:41] [speaker-0] let them say anything to you,
[00:32:42] [speaker-0] because we think that having our listeners value our opinion,
[00:32:46] [speaker-0] what we choose to bring to the podcast,
[00:32:47] [speaker-0] is really important.
[00:32:48] [speaker-1] And that's why we're having this conversation on air.
[00:32:50] [speaker-1] It's not only our opinions; it's also your opinion as the listener.
[00:32:54] [speaker-1] What do you think about this?
[00:32:55] [speaker-1] What do you think about the future?
[00:32:56] [speaker-1] Me and Anthony both want to make FS Jam as sustainable as possible.
[00:33:00] [speaker-1] One of my favorite podcasts ever,
[00:33:02] [speaker-1] Hello Internet,
[00:33:03] [speaker-1] had the kind of opinion of "It's up to the co-hosts.
[00:33:06] [speaker-1] You choose to listen or you don't.
[00:33:08] [speaker-1] You don't have a choice.
[00:33:09] [speaker-1] If they want to quit podcasting and never do another episode,
[00:33:12] [speaker-1] that's it."
[00:33:13] [speaker-1] And it is a relationship.
[00:33:15] [speaker-1] Who do I have a relationship with when I think about FS Jam?
[00:33:18] [speaker-1] Do I have a relationship with Anthony,
[00:33:20] [speaker-1] or do I have a relationship with me,
[00:33:21] [speaker-1] Anthony,
[00:33:22] [speaker-1] and also the listeners?
[00:33:24] [speaker-1] Are they part of the relationship?
[00:33:25] [speaker-1] Do they matter?
[00:33:26] [speaker-1] And the answer is to me:
[00:33:28] [speaker-1] the more we go on,
[00:33:29] [speaker-1] and the more people that
[00:33:30] [speaker-1] I speak to say,
[00:33:32] [speaker-1] "I know about the podcast.
[00:33:33] [speaker-1] I've listened to the podcast."
[00:33:34] [speaker-1] It's building that relationship with people,
[00:33:36] [speaker-1] and it's kind of about you know you could say it's weird about celebrityism,
[00:33:40] [speaker-1] about having one-sided relationships.
[00:33:42] [speaker-0] That's called a parasocial relationship.
[00:33:44] [speaker-0] It's a great term.
[00:33:45] [speaker-1] Yeah,
[00:33:46] [speaker-1] a parasocial relationship.
[00:33:48] [speaker-1] But as I was saying,
[00:33:49] [speaker-1] is like I want to make the podcast as sustainable as possible.
[00:33:53] [speaker-1] Something I'm interested in is that when we go to Utah,
[00:33:57] [speaker-1] I've actually ordered me and Anthony
[00:33:59] [speaker-1] FSJam T-shirts.
[00:34:00] [speaker-1] Is this something the listeners are interested in?
[00:34:03] [speaker-1] Would you want us to spit out a Teespring shop so you could buy an FSJam T-shirt to support the podcast advertisements?
[00:34:10] [speaker-1] We're going to start looking at sponsorships as a way to make FSJam more sustainable and.
[00:34:16] [speaker-1] The biggest part of it is obviously Anthony.
[00:34:18] [speaker-1] Anthony has edited every single podcast from day one,
[00:34:22] [speaker-1] and I'm forever grateful of that.
[00:34:24] [speaker-1] And I fully should expect Anthony and your time to be not necessarily paid,
[00:34:30] [speaker-1] but to be respected,
[00:34:32] [speaker-1] compensated.
[00:34:33] [speaker-1] Yes,
[00:34:33] [speaker-1] because that makes everything more sustainable in this world.
[00:34:36] [speaker-1] When you're doing something for free,
[00:34:38] [speaker-1] it's a lot harder to prioritize it,
[00:34:40] [speaker-1] and I think that is very,
[00:34:42] [speaker-1] very important.
[00:34:43] [speaker-1] But before we close this out.
[00:34:45] [speaker-1] What's been your favorite episode in the last few months?
[00:34:47] [speaker-1] What's been your highlight since we've last done one of these episodes?
[00:34:51] [speaker-0] That's a good question.
[00:34:53] [speaker-0] I liked the hydrogen episode.
[00:34:56] [speaker-0] That was a really interesting one because I didn't know anything about it,
[00:34:59] [speaker-0] and I'd never used.
[00:35:00] [speaker-0] It,
[00:35:00] [speaker-0] but I knew that if Shopify was putting together some sort of open source project,
[00:35:04] [speaker-0] it'd probably be pretty legit.
[00:35:06] [speaker-0] And then Josh is someone who like really has a lot of fantastic open source experience,
[00:35:11] [speaker-0] and he had a lot of great stuff to say.
[00:35:12] [speaker-0] And then it wraps into like the server component stuff,
[00:35:15] [speaker-0] which we've been talking about since the show almost started.
[00:35:17] [speaker-0] So there's a lot of interesting kind of long term trends that were represented by that episode,
[00:35:23] [speaker-0] and just the fact that.
[00:35:24] [speaker-0] No one has done a podcast about hydrogen yet.
[00:35:26] [speaker-0] That's one of the things that when I started this podcast,
[00:35:28] [speaker-0] I really wanted to do is I wanted to get people on to talk about subjects that hadn't even been talked about yet on a podcast.
[00:35:34] [speaker-0] Is the same thing with Marco.
[00:35:36] [speaker-0] So I think that having the ability now and having a platform to bring someone on,
[00:35:40] [speaker-0] like being able to see the projects that are coming up and be like,
[00:35:43] [speaker-0] hey,
[00:35:43] [speaker-0] this is something that's going to be important and consequential,
[00:35:45] [speaker-0] and people need to know about.
[00:35:46] [speaker-0] I can just reach out to that person and say,
[00:35:48] [speaker-0] "Hey,
[00:35:48] [speaker-0] come on my podcast,"
[00:35:49] [speaker-0] and it's pretty much a guaranteed yes at this point because we have like such an established lineup of guests that we have.
[00:35:54] [speaker-0] Pretty much,
[00:35:55] [speaker-0] we can go look at it like,
[00:35:55] [speaker-0] "Oh yeah,
[00:35:56] [speaker-0] these guys look pretty legit."
[00:35:57] [speaker-0] Like,
[00:35:57] [speaker-0] well,
[00:35:57] [speaker-0] they had Kenzie Dodds on,
[00:35:58] [speaker-0] so obviously it's a real podcast.
[00:36:00] [speaker-0] And yeah,
[00:36:00] [speaker-0] I would say I like the flight control episode as well because that also feeds into a lot of the things we've been talking about about deployments and how do you actually get a full stack Jamstack application online.
[00:36:11] [speaker-0] I think those are probably my two best recent favorites.
[00:36:14] [speaker-1] I really like seeing.
[00:36:16] [speaker-1] The journey of Brandon and the core contributors of Blitz.
[00:36:21] [speaker-1] This has actually been really interesting.
[00:36:22] [speaker-1] You could say that our roots of the podcast was Redwood JS and Blitz.
[00:36:26] [speaker-1] That these two brand new things,
[00:36:28] [speaker-1] but we've seen Redwood double down and excel at what they've been doing,
[00:36:32] [speaker-1] and we've seen Blitz evolve and move into this new standard.
[00:36:36] [speaker-1] We've seen Simon get hired by Netlify.
[00:36:39] [speaker-1] We've seen Brandon start his own company and being Y Combinator.
[00:36:43] [speaker-1] This is like super exciting.
[00:36:45] [speaker-1] It's amazing to see how everybody's growing.
[00:36:47] [speaker-1] One of the latest episodes we've done that I actually think wow every time is Author and Kenzie Dodds.
[00:36:55] [speaker-1] Kenzie Dodds,
[00:36:56] [speaker-1] he's an inspiration to us all in terms of learn and teaching React in JavaScript,
[00:37:01] [speaker-1] and obviously Remix.
[00:37:02] [speaker-1] That was the conversation that persuaded me to go to Remix conference.
[00:37:06] [speaker-1] And then second to that is Author.
[00:37:08] [speaker-1] Author's worked on the TypeScript team for so long,
[00:37:11] [speaker-1] very very knowledgeable,
[00:37:13] [speaker-1] and he's really.
[00:37:15] [speaker-1] Is a great resource and always willing to help people as well.
[00:37:19] [speaker-1] So they were two of my highlight episodes from the last few we've done.
[00:37:23] [speaker-1] Anything else you want to talk about before we close this one out of this massive ramble episode?
[00:37:28] [speaker-1] It's kind of like a toy box of just fun things that we want to speak about.
[00:37:32] [speaker-0] Yes,
[00:37:33] [speaker-0] that most of the episodes that we we do together usually end up turning into.
[00:37:37] [speaker-0] No,
[00:37:37] [speaker-0] nothing else from me.
[00:37:38] [speaker-0] Just that we appreciate all the listeners who continue to listen to us.
[00:37:43] [speaker-0] I know that.
[00:37:43] [speaker-0] There's a decent chunk of people that I hang out with on like Discords who like to listen to this,
[00:37:48] [speaker-0] so that's really great.
[00:37:49] [speaker-0] And I'm always wishing that I could put more time into this and really get it on a better cadence.
[00:37:55] [speaker-0] But it's been tough,
[00:37:56] [speaker-0] especially as I've been like transitioning into my new job.
[00:37:59] [speaker-0] But hopefully,
[00:37:59] [speaker-0] we can get ourselves to a point where we're at least like consistently putting out an episode every week.
[00:38:04] [speaker-0] Because I'd say I've dropped the ball on quite a few weeks over these last couple months.
[00:38:07] [speaker-0] But we're also creating content for the long run.
[00:38:10] [speaker-0] Like these are episodes that I think.
[00:38:12] [speaker-0] Are just as valuable to listen to like two years after the fact because even if the tech changes,
[00:38:16] [speaker-0] the concepts stay the same,
[00:38:18] [speaker-0] and the progression of how these things go is important as well.
[00:38:22] [speaker-0] I think that even if you're listening to a podcast about a technology that is not being used anymore,
[00:38:28] [speaker-0] it can be useful to listen to because it can give you a better context of why are things the way they are now today,
[00:38:36] [speaker-0] and that is really.
[00:38:37] [speaker-0] The goal for me with doing stuff like this is creating a kind of historical record for people who are going to be coming to web development for the first time years from now and are trying to figure out what the heck is going on,
[00:38:47] [speaker-0] what any of this stuff is,
[00:38:48] [speaker-0] and why they need to know about UMD and AMD and CJS and ESM and what any of that crap means.
[00:38:54] [speaker-0] So,
[00:38:54] [speaker-0] yeah,
[00:38:54] [speaker-0] feel free to just you know hit us up on the
[00:38:57] [speaker-0] Twitters fsjam.org if you ever want to get in touch with us or suggest a topic or ask if you can speak.
[00:39:04] [speaker-0] On the podcast,
[00:39:05] [speaker-0] we're always open.
[00:39:06] [speaker-0] As you're saying,
[00:39:06] [speaker-0] you know,
[00:39:06] [speaker-0] we'll kind of check you out and make sure you're legit.
[00:39:08] [speaker-0] But we're really open to anyone being on here and talking about what they're doing.
[00:39:12] [speaker-0] If you're working on something interesting,
[00:39:14] [speaker-1] the final thing I can say,
[00:39:15] [speaker-1] I can't believe we got Mishko on and we didn't even speak about Angular once.
[00:39:19] [speaker-0] Yeah,
[00:39:20] [speaker-0] I kind of wanted to,
[00:39:21] [speaker-0] but it was like Quick is such an interesting,
[00:39:22] [speaker-0] dense topic that I didn't want to kind of detract from it too much.
[00:39:25] [speaker-0] But yeah,
[00:39:26] [speaker-0] like he's a legend,
[00:39:27] [speaker-0] and he's someone who has done very consequential work on JavaScript.
[00:39:32] [speaker-0] That is affected,
[00:39:33] [speaker-0] you know,
[00:39:33] [speaker-0] all of us.
[00:39:33] [speaker-0] So,
[00:39:34] [speaker-0] yeah,
[00:39:34] [speaker-0] that was awesome.
[00:39:35] [speaker-0] It was really,
[00:39:35] [speaker-0] really cool to have Michka on.
[00:39:36] [speaker-0] Thank you to
[00:39:37] [speaker-0] Ryan for making that connection for us.
[00:39:40] [speaker-1] Yeah,
[00:39:40] [speaker-1] that's it for now.
[00:39:41] [speaker-1] Until we speak again.
[00:39:42] [speaker-1] Bye.
[00:39:43] [speaker-1] Bye.
[00:40:00] [speaker-1] Oh,
[00:40:15] [speaker-0] Cool.
[00:40:16] [speaker-1] I'm sure you can edit that into something decent.
[00:40:21] [speaker-1] Oh yeah.