---
title: "2024-04-10-autogen-shownotes-jenn-junod"
slug: "2024-04-10-autogen-shownotes-jenn-junod"
duration: "1:08:04"
channel: "Local"
url: "file:///Users/ajc/c/autoshow-cli/input/2024-04-10-autogen-shownotes-jenn-junod.mp4"
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
[00:00:01] [1] Hello, my YouTube error—oh no.
[00:00:04] [2] What? No, YouTube error. It started on the Twitch though, I think. I think it started on Twitch.
[00:00:13] [2] Is it working?
[00:00:14] [1] No, it did. It started on everything except YouTube. I've never—I've never seen this happen before.
[00:00:19] [2] Yay! It is. It is live. It is doing the things. We are—we made it. When's the last time you livestreamed?
[00:00:31] [1] Uh, apparently a long time since it's broken. Um, well, I've been doing some livestreaming for Dash, actually.
[00:00:37] [1] So I've done a bunch of livestreaming these last couple weeks. But the last time I did, AJC and the web devs, which is where we are.
[00:00:43] [1] Hello everyone, welcome to AJC and the web devs with JenJenod. Um, over a year ago, like a year and a half or so ago.
[00:00:51] [2] Okay.
[00:00:52] [1] Yeah, it's been a while. I think it was probably last summer, actually, because I had—I was streaming still past when I had stopped.
[00:01:01] [1] I stopped doing FXJam like a year and a half ago. And then the streaming—let's see, the last one was with, yeah, Brandon 10 months ago.
[00:01:11] [2] Okay.
[00:01:13] [1] And I did a couple, uh, I guess a couple streams here and there. I got to be on Ryan Carniata's stream, which was like the last, like, really good big stream.
[00:01:21] [1] I hadn't been on that I really wanted to be on. So I got to show him Redwood. It was like a five-hour marathon stream with him, which was epic.
[00:01:29] [1] And then I went on Dev's stream, I went on Ben Holmes's stream, I might be on Ben Holmes's stream again.
[00:01:35] [1] So, um, yeah, I've been doing kind of stuff here and there, but haven't been kind of doing my own thing.
[00:01:42] [1] And, um, you're in a similar boat. You kind of taken a break from Teach Gen Tech, which we are also streaming to right now, I believe.
[00:01:50] [1] So, oh yeah, let me go to—yes, we have Ben! Oh my god. Someone else who had an epic stream that he took a hiatus from Semantics, hasn't done anything in a while.
[00:02:02] [2] Dude, it's needed. It's needed.
[00:02:05] [1] The gang all back together. Oh, that makes me so happy. Thank you for being here, Ben.
[00:02:09] [2] Do you want to come stream with us, Ben? Like, I'll just kind of volunteer you.
[00:02:12] [2] Like, if you want to come on stream. Like, um, yeah.
[00:02:17] [1] I'm going to keep saying it's on hiatus so I can keep pretending like one day it'll come back.
[00:02:23] [2] I totally get that. I totally get that.
[00:02:25] [1] Yeah, and no worries. No worries, Ben.
[00:02:28] [2] I get that.
[00:02:28] [1] But, um, yeah, so what's up? What's up in your life, Jen?
[00:02:33] [2] Uh, wow. Okay. It's been
[00:02:37] [2] five months since I streamed, I think. It's been a hot minute. I was planning—it was kind of funny.
[00:02:43] [2] I was planning on going back pretty like, "Okay, I'll take, you know, Christmas off, the holidays, things are stressful."
[00:02:50] [2] And then I was like, "Okay, I really want to restart my podcast. I'm going to put Teach Gen Tech on the sidelines.
[00:02:57] [2] Like, I'll get there." And it was just
[00:03:00] [2] —we were talking about this offline, but I was putting way too much pressure on myself more than like anybody else was.
[00:03:07] [2] And because I was like, "To be successful, you have to do it at the same time every single week.
[00:03:12] [2] " And
[00:03:16] [2] —
[00:03:16] [1] Do you know this person?
[00:03:17] [2] Yes. Yes. Hello, Sarah. Uh, and—
[00:03:22] [1] Welcome.
[00:03:23] [2] I think your husband just messaged me. Yes. If I'm on the CTA luncheon. Um.
[00:03:34] [1] That was going through my head.
[00:03:36] [2] Yeah. So it was—it was a lot of like,
[00:03:43] [2] I couldn't keep—I was also not as focused with Teach Gen Tech as I was with work.
[00:03:50] [2] Because with work, I was
[00:03:53] [2] , uh, very—getting into a very, very technical field. And I still am. And trying to balance that with things that don't necessarily relate to it and learn two different tracks.
[00:04:06] [2] I wasn't able to keep up with both at the same time. That, yeah, I had to kind of go, "What am I going to work on?
[00:04:14] [2] What am I going to focus on for 2024?" And
[00:04:19] [2] I—it's weird. I was like, "I'm never going to livestream again." And then
[00:04:25] [2] I'm like, "I'm actually kind of excited to livestream. I haven't livestreamed in a long time.
[00:04:29] [2] " And it brought the fun.
[00:04:31] [1] Yeah, it is fun.
[00:04:32] [2] Yeah.
[00:04:33] [1] Yeah.
[00:04:33] [2] It is. It is. It is. It is a lot of fun.
[00:04:37] [1] It's fun when you, like you say, don't put too much pressure and stress on yourself.
[00:04:41] [1] Because when you're doing it just for you, that's what I was telling you. You know, you got to just keep doing it, but do it for you.
[00:04:47] [1] That's like the good balance to strike. Because, you know, we—it's good to have like high expectations and to, like, in one sense, put pressure on yourself.
[00:04:57] [1] Because that's really what, like, any high-level achiever, the reason why they're a high-level achiever is usually because they are way more critical of their own output than most people.
[00:05:08] [1] But that also can lead to like a lot of neuroses, which is not healthy either. Like with FSJam, I would spend so long editing the episodes, just making them like so perfect, and then.
[00:05:18] [2] Really quick. I'm going to be so rude, and I need to interrupt, and I need to tell you this, especially if Sarah is still here.
[00:05:26] [2] Sarah and Jen need to be friends.
[00:05:28] [1] Okay.
[00:05:30] [1] This is another Jen. For people who don't know, my wife's name is Jen.
[00:05:34] [2] His wife's name is Jen. And so.
[00:05:36] [1] Did you send me a Discord message so I remember?
[00:05:39] [2] Yes. And I really need to say that. And Sarah, I will introduce you guys because you definitely need to be friends.
[00:05:45] [2] They're both writers.
[00:05:47] [1] Oh, great.
[00:05:48] [2] And, uh, they do really cool writing. Anyway, please continue. Yes.
[00:05:52] [1] No, thank you. No, thank you for interrupting. I was. Always looking for more friends for Jen, so that's great.
[00:05:59] [1] But, um, yeah, I mean, I had started FSJam back in 2020 and then had done it all throughout while I had my step-send job.
[00:06:06] [1] I was able to balance those pretty well. And then once I joined QuickNode, it's like in your situation where you're having to learn a lot of really specific technical stuff.
[00:06:15] [1] And I'm sure you didn't want to just bring on database people every single day to teach Gen Tech because that might.
[00:06:21] [2] I kind of did, but not everybody wanted to watch that.
[00:06:24] [1] Exactly. So I didn't want to just bring a bunch of blockchain people onto FSJam.
[00:06:27] [1] I knew that no one would really appreciate that or enjoy it, even me. So I ended up kind of falling off on a lot of things.
[00:06:35] [1] And then I joined Edgio at the beginning of 2023, kind of with the idea of tying all these things back together.
[00:06:41] [1] But what ended up happening is basically all of the energy and time and brain space I would have put into FSJam then went into JavaScript Jam, which ended up being very similar in terms of the content we created and the
[00:06:52] [1] guests we interviewed and stuff like that. So that was cool. And I did that for all of 2023, basically.
[00:06:59] [1] But then JavaScript Jam got kind of canceled by the company because the company went off a cliff.
[00:07:06] [1] And we weren't really—admittedly, we were not really able to show a whole lot of direct value in terms of what we were bringing to Edgio.
[00:07:15] [1] I think we brought a lot of value to the JavaScript community, that's for sure.
[00:07:19] [1] But, um, not so much translating that directly into business dollars. So they decided to kind of, um,
[00:07:29] [1] disinvest, de-invest for the term is. And, um, Scott had been laid off, so he was the person I was kind of running the whole thing with.
[00:07:37] [1] And I kept doing it up until when the company went up until when I quit. So I quit then.
[00:07:42] [1] It's the next part of that story. But, um, I'm still talking to Eshaan about possibly continuing it if, um, Edgio wants to, like, pay me a contract role.
[00:07:51] [1] But anyway, this is all minutia stuff. So, yeah, so I quit Edgio about a month ago because I just wasn't very happy there.
[00:07:57] [1] I wasn't really getting to work on anything that interested me or that I felt was even within my skill set.
[00:08:03] [1] Because they were kind of pivoting to security. So I'm going solo now and doing freelance contract kind of work for Dash.
[00:08:12] [1] So their DAO is paying me to create stuff for Dash, which is a cryptocurrency. So that's pretty cool.
[00:08:17] [1] And then I'm writing blog posts for EverFund, which is, um, Chris, my co-host from FSJam, his company.
[00:08:23] [1] They want to write some articles about, like, nonprofits and AI and stuff like that.
[00:08:27] [1] So, yeah, so I've got, you know, some things I'm kind of doing. And that also means I have kind of more free time now and just mental space to do things like Streamy again and bring FSJam back and trying to reconnect with
[00:08:39] [1] all the people I used to, you know, hang out with and stream and make content with back in 2021, 2022.
[00:08:46] [1] I've kind of fallen off on.
[00:08:48] [2] Wow.
[00:08:48] [1] So Ben, even though you're not doing Semantics anymore, I would like to have you as a guest back here sometime if you want.
[00:08:56] [1] I don't even know who to talk to, but we could always—I could always throw websites at you and have you make me do better accessibility on them.
[00:09:04] [1] That's always fun.
[00:09:05] [2] Todd Libby was on my podcast, "Shit You Don't Want to Talk About."
[00:09:11] [1] Ooh.
[00:09:12] [2] You know, uh,
[00:09:15] [2] I'm going to the website and grabbing it for you. Um, it was—it was really good.
[00:09:21] [2] It was a, um, I will say that is a, I feel like a big thing that I did not
[00:09:31] [2] —there's things I've learned after being in DevRel for a year now and, like, working in a, uh, at a company for a year is making content can be a lot of fun.
[00:09:45] [2] Making content can also
[00:09:49] [2] take away the fun of it.
[00:09:52] [1] Especially if you have to create content you're not interested in.
[00:09:56] [2] I'm like, I'm interested in it. It's more of, again, I was putting way too much pressure on myself for it.
[00:10:03] [2] And
[00:10:04] [2] , um, which made it really difficult to keep up with. And, but it was, uh, from the
[00:10:16] [2] stream that we did, um, Ben—or Ben, you were around for it. That's why I keep saying you.
[00:10:21] [2] Because Ben was the original OG that did accessibility stream with me. Um, but it was the one with Graham that Todd listened in on and then was like, "Yeah, I want to be on the show."
[00:10:33] [2] And I was like, he told me he listened to all of the episodes. And I was like, "You listened to the entire what?
[00:10:40] [2] "
[00:10:40] [1] How many are there?
[00:10:41] [2] Really? 60 plus.
[00:10:44] [1] That's a good amount.
[00:10:45] [2] And I was just like, "Oh my god, that's so cool." So it was, uh, yeah. Yeah. But again, because Ben introduced me to so many random people.
[00:10:53] [2] And thank you, Ben.
[00:10:55] [1] Totally. Yeah, he was, um, definitely a huge force in helping get the word out on a lot of those types of people
[00:11:04] [1] .
[00:11:04] [2] Yeah. Yay. So what are we going to do today, Anthony?
[00:11:09] [1] So we are going to—you never finished the Teach Gen Tech website. And so I want to kind of work on that because I think you were pretty close, but the problem was you wanted to use a database with Astro, and there was no
[00:11:24] [1] way to do that. But guess what? Astro has a database now. Also, Learner is here.
[00:11:30] [1] What's up, Learner?
[00:11:31] [2] What up, Learner? Um, yeah, it was more of I wanted—I specifically wanted Astro to work with Postgres for Ivan.
[00:11:45] [2] Or Ivan for Postgres is what I'm saying.
[00:11:47] [1] Postgres with Ivan. That wasn't even the issue. It could have been if you wanted to do MySQL with Planet Scale, it would have been the exact same thing.
[00:11:52] [2] It wouldn't have worked. Exactly.
[00:11:54] [1] They just didn't have a good way of working with a database. Yeah.
[00:11:56] [2] Exactly. Yeah. So, and I haven't—also, as an update, I started focusing more on Python.
[00:12:03] [2] And so that's been a fun, uh, change too.
[00:12:07] [1] How do you set up your virtual environments
[00:12:10] [1] ? I need to know.
[00:12:14] [2] Code spaces.
[00:12:16] [1] So you code Python through the browser?
[00:12:19] [2] Yeah.
[00:12:20] [1] That's really smart because using Python locally is pure nightmare fuel.
[00:12:26] [2] Yeah. It's, I mean, it's, um, it's had its—it's had its challenges. It's had its challenges in learning all of that.
[00:12:33] [2] But yeah.
[00:12:35] [1] No, that's great. I've been—I was saying like two years ago, I interviewed a bunch of people who are working at companies like GetPod and other things like code spaces.
[00:12:45] [1] And I was saying, "This is the future. Like, everyone's going to code in the browser all the time.
[00:12:48] [1] People are going to learn to code through the browser." And, uh, I still think that's true.
[00:12:52] [1] I think we're there for some people who code specific things and have specifically good internet connections.
[00:13:02] [1] So it's kind of like a small group of people are able to actually really do that effectively today, but more and more people will be able to do that in the future.
[00:13:10] [1] The NASA music on stream was so phenomenal. Do you know what this is referring to?
[00:13:16] [2] Yeah. Just, it's a—Learner is like the best at watching streams is what I've, I've, I've decided.
[00:13:26] [2] I'm like, "Dude, I do not keep up with people."
[00:13:29] [1] Also, Be One Mind, other longtime fan here. Yeah, no, I see Learner in most of the streams I go to.
[00:13:36] [1] I still—I try and still watch some streams. I still check out Nikki T's. I still check out, um, who else was I watching recently?
[00:13:48] [1] Um, yeah, Jason Leisors every now and then. But I'm less interested in kind of like what's the new tool.
[00:13:57] [2] I just ignore everybody. I'm like, "Y'all, I'm playing, uh, Dragon Age and putting together puzzles when I'm not
[00:14:05] [2] working."
[00:14:06] [1] Yeah. Yeah, usually I have it on the background while I'm doing actual work. That's how I can still kind of.
[00:14:10] [2] That's smart.
[00:14:11] [1] But if you were to actually sit down and watch all of these streams, especially like a year or two ago when it was really popping off, it would have taken you like five or six hours a day, and that would have been the only
[00:14:20] [1] thing you were doing. So it's like, at a certain point, you have to choose how you use your—say like Discord servers, you know?
[00:14:27] [1] I mean, I took a huge, huge step back from Discord and watching Twitch streams.
[00:14:33] [1] And, um, yeah, it was—it was good. It was necessary. But also, that was kind of how I was getting all of my social connections.
[00:14:39] [1] It's like all of my friends I was like making through those kind of things. And once I kind of stepped back from those, I kind of felt like I had lost touch with a lot of my friends as well.
[00:14:48] [1] So trying to figure out that balance is kind of what I'm working on now. But anyway, go ahead.
[00:14:55] [2] Yes. Yes, go ahead. Go ahead. I'm ready for whatever you're bringing next.
[00:14:59] [1] Yeah. So we're probably not going to do the Astro database stuff today. That will be a kind of later thing.
[00:15:04] [1] But that's one of the things also, like, I just want an excuse to learn Astro database.
[00:15:08] [1] So we'll use your website as a test case for that as well. And then, um, I have this basically workflow I've been creating that does a transcription and then, uh, like ChatGPT kind of like prompting thing to create show
[00:15:26] [1] notes for either podcasts or videos like this. Because, you know, I have so much content that I've created that's just kind of sitting around on different parts of the internet.
[00:15:36] [1] And most of it had not been transcribed. And this is something that, you know, Ben was really good about with Semantics, he transcribed every single one of his episodes, which I know took him a lot of time.
[00:15:45] [1] So unfortunately, that's something that has always been hard to do unless you just want to fork out the money for a transcription service.
[00:15:52] [1] But there's open source way to do that pretty well enough now. You still need to make corrections, and they still don't really put a whole lot of punctuation in, and they don't separate speakers, but it gives you just l
[00:16:03] [1] ike a raw dump that can be analyzed for other things. So I showed you how to use this on your stream, actually.
[00:16:09] [1] So we did the episode on Whisper. You remember that?
[00:16:12] [2] Yes. I'll see if I can, uh, find.
[00:16:15] [1] I can get it, yeah.
[00:16:16] [2] Oh, you got it? You got it already? Because that is, um, just as an update for everybody who has been like, "Jen, you've rebuilt your website like 20 million times on stream specifically.
[00:16:30] [2] " Uh, I actually took a step back and put it all on Squarespace. I took—I took away all of the coding.
[00:16:43] [2] And I was like, "No."
[00:16:45] [1] And that is for—I know that's for shit you don't talk about, but is that also for Teach Gen Tech?
[00:16:49] [1] Are there links to old episodes?
[00:16:52] [2] It, it, so I feel like this might make a bit more sense on what the process is.
[00:16:56] [2] So you can see
[00:16:59] [2] where it needs help because, y'all, it, it needs some love. We'll definitely go with that.
[00:17:04] [2] So give me a second. Share my screen.
[00:17:09] [2] Uh, okay.
[00:17:12] [2] Um, will you please share my screen, sir?
[00:17:15] [1] Yes.
[00:17:15] [2] Yay. Hey, is my website. And my face. Um, the way it started is I went through and I was like, "I don't—I don't even know what to do with my website.
[00:17:26] [2] " But
[00:17:28] [2] I started doing every single episode of Shit You Don't Want to Talk About. And I would go through, there are 60 plus episodes, and
[00:17:39] [2] I auto-generated the show notes and then embedded
[00:17:45] [2] their, their, the transcript. I auto-generated that from a tool called Parrot. And then I embedded it, and that, that was it.
[00:17:54] [2] And I did all like 60 plus episodes. It took me like two weeks to get this done.
[00:17:58] [2] It was exhausting. And I was like, "This is the same time." This was the end of November when I was like, "Oh, I'm going to do this for Teach Gen Tech while I, uh, and I'll take a break while I get this done.
[00:18:11] [2] " And
[00:18:13] [2] it, it's a lot of updating because I was updating all of my thumbnails. I was updating all of the transcripts.
[00:18:20] [2] And if I go here.
[00:18:23] [1] Yeah, this is why this is such a perfect use case for what we're trying to do. So try and create a workflow to automate the vast majority of this process.
[00:18:30] [2] Yeah. So it, it like I was, I got the first one done and-ish, where I embedded the YouTube video and
[00:18:42] [2] I put it all the transcript in there and stuff like that. But my YouTube still kind of struggled.
[00:18:48] [2] Is everything that's done in these was, and let me show you Parrot because this was like so many different steps.
[00:18:58] [2] Like this took many, many, many, many steps. And it's expensive. It wasn't, um, so you have to like.
[00:19:06] [1] This will involve hopefully one step. You just give a URL and it will be free.
[00:19:10] [2] You have to upload it. And then you have to wait. And then you have to like copy and paste it and like do so much of it.
[00:19:18] [2] And then I had to paste it in here. And then I had to go back to YouTube and be like, "Oh, okay.
[00:19:25] [2] Let me, I'll go to a recent one. More recent. Like this is November 20th was apparently the last ones.
[00:19:33] [2] " And then
[00:19:35] [2] I had to put it all in, oh, then I had to put it into ChatGPT.
[00:19:41] [2] And.
[00:19:42] [1] What were you using that for? What did you have it output?
[00:19:45] [2] For the summary. For the summary. And links. And then I had to upload it to YouTube because I was just streaming to Twitch because that was like an added complication on it of YouTube gets better views if you upload it to
[00:19:59] [2] YouTube instead of just stream to YouTube.
[00:20:03] [2] And yeah, and then trying to share it and social media this shit. It just, it was, I know.
[00:20:10] [2] No.
[00:20:10] [1] That's a lot.
[00:20:12] [2] Yeah. So I, that's, that's where we landed of it never really got done. Some of the transcripts got done, and I never built the website out for it because it was too much.
[00:20:25] [1] So I guess a couple of questions for me that will help guide this is, do you want there to be Teach Gen Tech and Shit You Don't Want to Talk About both under the banner of GenGenAut.com, or would you want a separate website
[00:20:37] [1] for Teach Gen Tech?
[00:20:39] [2] I thought I wanted them all under the banner of GenGenAut. And I'm like, "I don't.
[00:20:44] [2] I want GenGenAut to just be a landing page that can link out shit." And I need to create three websites.
[00:20:50] [1] You don't want to talk about and Teach Gen Tech to both be different websites and GenGenAut be a third one.
[00:20:55] [2] Yeah. Yeah. I'm not excited about that, but after doing it so many different ways, it's like, that's basically, it's going to be the best bet because GenGenAut is never like that website's barely ever going to change.
[00:21:09] [2] It's going to be a simple one-page landing page. And then Teach Gen Tech will do all my tech stuff, and then Shit You Don't Want to Talk About will do all its stuff.
[00:21:18] [2] But yeah, it needs to not be all under one.
[00:21:22] [1] So do you still have the last Astro site you were building for Teach Gen Tech? And can we pull that up
[00:21:30] [1] ?
[00:21:32] [1] It should still be on your GitHub.
[00:21:34] [2] I was going to say it's probably still on my GitHub.
[00:21:37] [1] Yeah, like you delete things from your GitHub very often.
[00:21:41] [2] I don't. That is.
[00:21:43] [1] You're not supposed to. People will tell you not to, but I've deleted so much stuff from my GitHub because otherwise I would just have 500 repos.
[00:21:50] [1] Oh, hello. Hello. Ben Myers.dev being redesigned. Exciting.
[00:21:56] [2] Ooh.
[00:21:57] [1] The way it looks so good though. Are you getting rid of the purple? Is that it?
[00:22:01] [1] Did you decide you hate purple, Ben?
[00:22:03] [2] No, don't get rid of the purple. Look, we're both, like he's wearing purple. I have purple hair.
[00:22:08] [2] Like you can't get rid of the purple. Okay, you really can like do what you want.
[00:22:12] [2] Um, let me say that.
[00:22:14] [1] Let's get back to automatic purple.
[00:22:17] [1] Yeah. Called it.
[00:22:20] [2] That's amazing.
[00:22:21] [1] That's funny. It just gave me a purple square with purple text. And he's like, "Yeah, I've decided purple is more important to me than accessibility.
[00:22:29] [1] I've created the hierarchy purple than accessibility." So the text and the background needs to be purple.
[00:22:35] [1] Don't do that, people.
[00:22:38] [2] When is this one from? I think this is still live, but I don't think it can.
[00:22:46] [1] Can you share your screen?
[00:22:48] [2] Yeah, I can.
[00:22:54] [2] And I think that's been a big part of it too is I was like, "I'm going to make this the coolest thing possible."
[00:23:00] [2] And I'm like trying to learn that and make it. Trying to create content while you're learning is not like the easiest thing to do.
[00:23:08] [2] Like Roy and I worked on this really hard.
[00:23:12] [1] Excuse me, man.
[00:23:14] [2] Um, yeah.
[00:23:16] [1] There we go. So this is GenGenAut for/site.
[00:23:21] [2] Um, yeah, but I don'
[00:23:23] [2] t, oh, it had, it has some stuff. Oh, this one.
[00:23:28] [1] This is not what I was talking about. You had another one. You had an Astro site.
[00:23:32] [2] I know. I have a lot of, that's why we're.
[00:23:35] [1] I refuse to use Next.js to build a static site.
[00:23:40] [2] Was it this one?
[00:23:43] [2] Let me see. Oh, yeah, it was this one.
[00:23:45] [1] This is the one. This is the one I was thinking of.
[00:23:47] [2] But it didn't get very far. It has more details coming soon.
[00:23:51] [1] Go back to the GitHub real quick. So this is website instead of site. Clever.
[00:23:56] [2] Yeah, because naming is one of the hardest things about being a developer is what I've decided.
[00:24:01] [1] I would call it TJT, Teach Gen Tech. That's what the repo should be called.
[00:24:06] [2] Um, let's see. Let me, hold on. Hold on. Let's go home.
[00:24:10] [1] Just, let's look at my repos. Your URL and you can see if it's already taken.
[00:24:15] [2] I know. I was like, "I have so many different variations."
[00:24:18] [1] No, TJT is not taken. You also didn't, do you still have the Teach Gen Tech GitHub?
[00:24:25] [2] Uh, yeah.
[00:24:28] [1] Yeah, that I would recommend probably getting rid of.
[00:24:33] [2] Hey, yeah.
[00:24:35] [2] It has its own org. It's cool. It's fine. We'll go back to me.
[00:24:40] [1] There's also a website on here.
[00:24:45] [1] Oh, yeah. Here we go. You have a whole separate one here.
[00:24:49] [2] What is that one? Yeah, because, uh, and.
[00:24:52] [1] So it's teach-gen-tech for slash website.
[00:24:58] [2] Oh, well.
[00:24:59] [1] I think actually this might have been the one I was thinking of.
[00:25:03] [2] Let's see. This might have been the first one I was working on. Oh, yeah. This is all, I loved this.
[00:25:12] [2] This one I worked so hard on, y'all. Like I worked.
[00:25:15] [1] I'm in here. If you go to portfolio.
[00:25:17] [2] Hard.
[00:25:18] [1] I'm on this one.
[00:25:20] [2] Like I worked so hard on this one. I was, I just didn't like the way it looked.
[00:25:27] [2] I wanted it to look like this one. So I started from scratch. And we're very grateful for you, Learner.
[00:25:37] [1] I think they're both Astro sites.
[00:25:39] [2] They are both Astro sites.
[00:25:40] [1] Yeah. So under the hood, they're going to be fairly simple or simpler. I mean.
[00:25:46] [2] But all
[00:25:49] [2] , baby Jen doing stuff. So cute.
[00:25:56] [2] Anyway, don't mind me, y'all. These are down memory lane.
[00:26:00] [1] Yeah, so this is from, this is in March 2023.
[00:26:04] [2] Yeah.
[00:26:04] [1] The last commit on this.
[00:26:08] [2] Aw.
[00:26:11] [2] Yeah, because I got my job at Ivan. And then I also got really, really sick at that point.
[00:26:16] [2] I got pneumonia and bronchitis and COVID and got stuck in Finland. It wasn't pretty.
[00:26:22] [2] So.
[00:26:23] [1] Bummer.
[00:26:25] [2] Uh, I'm, I'm down to do, I'm down with starting from scratch, by the way. Like if we want to just like.
[00:26:32] [1] Yeah, that's what I'm trying to figure out whether we should, because it looks like you were going off of this brutal Astro starter.
[00:26:40] [1] I do think going with Astro starters is a lot of times a good way to go. That's how I built my website.
[00:26:45] [1] And then I kind of slowly tweaked it to make it look slightly different. So I've seen a couple of people now use the same template.
[00:26:56] [1] So I guess it's like, do you still like the look of the brutal one? So let's go, let's go to the theme itself real quick and see if we want to just, I would say we should either restart with this theme or pick a different
[00:27:06] [1] theme.
[00:27:07] [2] I'm going to say let's pick a different theme. We're going to, let's just start from scratch.
[00:27:13] [2] So I guess that means I have to go to Astro
[00:27:17] [2] and look at some themes.
[00:27:20] [1] Yeah, I've looked at them a whole bunch of times. Some of the ones that are more popular, actually try, try Astro Wind first.
[00:27:30] [1] It's going to be Astro and Tailwind
[00:27:34] [1] .
[00:27:36] [2] I'm just going to look at them all.
[00:27:42] [1] Astro paper is pretty good, but it just looks like a blog. I don't think that's really what you want.
[00:27:47] [2] I don't, I don't know. There's so many. There's so many. What, what do y'all think we should use?
[00:27:56] [1] So this is what, this is why if I use a starter or a template from this, usually I'll look at what are the most popular, most starred ones, because that means a lot of people have probably contributed to it and it may still
[00:28:07] [1] be actively maintained. So just Google real quick, Astro Wind, one word
[00:28:13] [1] .
[00:28:13] [2] Okay, let's get Astro Wind.
[00:28:16] [1] And the good thing with, yeah, and the good thing with Astro is that because it's just like a stack site generator, if you end up building something out and you don't really like the look of it, you probably just have l
[00:28:26] [1] ike markdown files that you can, you can switch out. So it looks kind of like a tech site, obviously, but it looks professional, right?
[00:28:36] [2] Yeah, yeah, yeah. I'd be down for this because I feel like
[00:28:40] [2] this has a lot to do with what I was trying to do with my very, very first site.
[00:28:47] [1] Right, yeah.
[00:28:47] [2] Way back when. Aw. Okay, well, let's get this template. Here we go. And let's see.
[00:28:55] [2] Let's fork it. Yay.
[00:28:58] [1] So you can click use the template. I think it's what you want to do, not fork it, I'm guessing.
[00:29:02] [1] Let me go back real quick to the GitHub.
[00:29:07] [1] And see where it says use this template.
[00:29:11] [2] Is this like,
[00:29:13] [2] I feel like we don't want to do open in the code space. I mean, like we could.
[00:29:16] [1] Well, we can, well, let's do the, let's make the repo first and then we can do that.
[00:29:21] [2] Okay, fine. We're going to call this TJT.
[00:29:24] [1] Yes.
[00:29:26] [2] Okay. It's going to be public. Yay.
[00:29:32] [2] Generating.
[00:29:34] [2] Here y'all, I will put it, I'll put it in the chat.
[00:29:43] [2] Look at that. Oh my gosh. We hav
[00:29:49] [2] e, oh, I have to go set it up with Vercel and stuff now.
[00:29:53] [1] You don't have to. You can deploy Astro wherever you want. It's just going to be configured for that out of the box, but it doesn't matter.
[00:30:00] [1] If you, so I guess do you have any, I guess since you have Squarespace, you probably don't have any just like general sites running on something like a hosting service anywhere.
[00:30:09] [1] I know I showed you how to use Vercel. Have you used Netlify yet?
[00:30:12] [2] Mm-hmm.
[00:30:13] [1] Have you, yeah, so you, have you used Cloudflare?
[00:30:15] [2] Netlify. No.
[00:30:18] [1] Yeah, so, so here's, here's why I use Cloudflare. I don't use Netlify or Vercel.
[00:30:24] [1] The reason why is because Cloudflare is just more built out for like everything.
[00:30:32] [1] You can, especially like hosting your DNS. So you can host domains or you can, you can connect to domains on Netlify or Vercel.
[00:30:41] [1] And I think you can even host them too, but those are just like very small pieces.
[00:30:46] [1] And the main thing is about like deploying the site for that. So I just find that it's a lot like just working.
[00:30:54] [1] If you have a whole bunch of websites, then Cloudflare is kind of the way to go.
[00:30:57] [1] If you just have one site, it really doesn't make that big of a difference. So if we want to host something like Netlify or Vercel, it's kind of whatever either way.
[00:31:06] [1] But we don't need to worry about any of that right now.
[00:31:09] [2] Fair enough. I feel like I need to do this in like a code space though, because.
[00:31:14] [1] Let's do it. You can just put your name in there and kind of get rid of the boilerplate.
[00:31:20] [2] Yeah. Setting up your code space.
[00:31:24] [1] Because this template comes with a whole bunch of extra crap, some of which is not even built out yet.
[00:31:29] [1] Like they have all these extra pages that are like for different SaaS type stuff.
[00:31:33] [1] If you click it, it just says coming soon.
[00:31:36] [2] And I will say this is like a big thing about
[00:31:41] [2] like being on the more of the infrastructure side is like, dude, I haven't touched this stuff in forever.
[00:31:48] [2] Like am I going to even remember how to do any of it? We'll see.
[00:31:52] [1] Let's just go to the homepage first.
[00:31:56] [2] I'm going to do all the installs really quick. Stop, stop. All the recommended.
[00:32:01] [2] Are you installing?
[00:32:02] [1] You're definitely with the Astro one. That's the, that's one of those that I use.
[00:32:06] [2] Okay, go to the homepage.
[00:32:10] [2] Is that what you said? Just go to the homepage?
[00:32:12] [1] Yeah, so SRC and then it should be index.astro under pages.
[00:32:21] [1] Yep, index.astro. And then in your terminal, npm run dev
[00:32:27] [1] .
[00:32:31] [1] You can X out that other thing in the bottom right too.
[00:32:36] [1] No, sorry, npm i first.
[00:32:43] [2] Npm i run dev?
[00:32:44] [1] Yeah, just npm i. That's it. Just the single, just to, with a space in between for, that's installing your dependencies, npm space i.
[00:32:52] [1] Yeah.
[00:32:54] [2] There we go. I can remember.
[00:32:56] [1] I can tell you've been doing Python for a while.
[00:32:58] [2] I'm like, what am I doing again? Huh? Wait, what? What?
[00:33:03] [1] Yeah, I have all my stuff configured. So when I open my terminal, I press the letter A and that alias is to going into my blog directory, opening the terminal and installing my dependencies all at the same time.
[00:33:15] [1] So I just do one letter and then I'm in. Now npm run dev. Yep.
[00:33:20] [2] I will say I don't
[00:33:25] [2] remember like why do people not just use code spaces for everything?
[00:33:31] [1] A couple reasons. It's the internet latency makes things go slower. And if you have a large enough project, it just won't work at all.
[00:33:42] [2] Oh, it's going to look up end stuff. I'm getting distracted. Let's look at the end stuff.
[00:33:47] [1] Oh, that's cool. He's talking about aliasing. Your directory is the Unix way.
[00:33:53] [1] Yes, basically why I was, you should unbunk your font up.
[00:33:57] [1] Yeah, do you have any aliases set? Yeah, what? Vendas is exactly the thing I have at CD into it.
[00:34:04] [1] Remember you used to always have to go to your code thing, which was like on your desktop or something.
[00:34:08] [2] Oh yeah, I set it up that it doesn't do that now. Like it does that. But I mean, it took a while and yeah, but all right.
[00:34:18] [2] Where did my code space go? Code space.
[00:34:20] [1] Yeah, I started to make more aliases and just like work on like scripting and so ChatGPT, I can have it generate all sorts of scripts.
[00:34:28] [1] I can do all sorts of useful stuff for me. Before that, I would have struggled to just like sit down and write myself.
[00:34:33] [1] Like things I could have figured out, but the length of time it would take would almost not make it worth it.
[00:34:38] [1] But now I have a way of kind of like getting better at scripting by working through scripts with ChatGPT.
[00:34:45] [1] It's really nice actually. I've learned a ton.
[00:34:48] [2] Nice. All right. So I got it open. This is what it looks like. Very exciting stuff.
[00:34:56] [2] So many things to update.
[00:34:58] [1] Cool. So we should actually stop here because I want to do just in the last 20 minutes, we have, I'm going to share my screen and show how we're going to kind of bootstrap this thing real quick.
[00:35:12] [1] I'm just going to close out
[00:35:16] [1] all the stuff. Stuff open.
[00:35:21] [1] And there's this really cool tool called
[00:35:26] [1] YT-DLP, I think it is. It's
[00:35:33] [1] for downloading stuff from YouTube. So if you're someone who has a YouTube channel at all, especially a dev YouTube channel that has a website, this thing is crazy useful.
[00:35:46] [1] So let me share my screen and hopefully all the things work. Cool. Okay. So this is a tool that lets you, I mean, like the, this README is like so massive and if you look at the options, it just like goes on and on and on
[00:36:05] [1] and on forever. So it's like pretty intimidating when you first start learning it.
[00:36:11] [1] But just let me just show kind of like a
[00:36:17] [1] simple thing you can do. So I have this blog post that we're going to be using.
[00:36:21] [1] Auto-generate podcast show notes with YT-DLP, ChatGPT, and Whisper. And this is the part of the flow that takes a video, transcribes it, creates a prompt for you, and then that will generate your show notes as well.
[00:36:39] [1] And there's a separate part that I have mostly built out that's not in the blog post yet that shows how to do this for a whole playlist or channel.
[00:36:52] [1] And because every channel has a base playlist that is every video they have. So if you take that, you can take the playlist and you could generate a markdown page for every video.
[00:37:03] [1] And then that will take the information from YouTube, the metadata to do that. And then I'm going to combine that with the part I have in the blog post and then just have it run that process on every single video instead
[00:37:16] [1] of just running it on a single video that you feed it. So that may have been super confusing.
[00:37:22] [1] So I'm just going to walk through a couple, a couple of things so you can see what I mean.
[00:37:31] [1] Let me actually take that link that you gave me. Can you drop that?
[00:37:37] [2] Exception?
[00:37:38] [1] In the private chat, actually.
[00:37:40] [2] Which of the many?
[00:37:41] [1] The YouTube one that you wanted me to start with from your channel.
[00:37:46] [2] Yeah.
[00:37:48] [2] Hold on. Hold, please. I'm not a robot, bro.
[00:37:53] [1] No, it's fine. Take your time.
[00:37:56] [2] Sure. Yep.
[00:38:00] [2] I'm going to put it in the regular chat, but I'll also put it in the private chat.
[00:38:03] [2] So that way people know what we're working on today.
[00:38:07] [1] Yep. Yeah, I just needed that because you can't copy-paste things if they're here.
[00:38:10] [1] So I try and click it and just.
[00:38:12] [2] I know it's so dumb. It's so dumb. StreamYard. Come on.
[00:38:16] [1] Okay, so this is.
[00:38:16] [2] We've been friends for a long time.
[00:38:18] [1] Here.
[00:38:19] [2] Yes.
[00:38:20] [1] And what we're going to do is we're going to run my thing on it. So
[00:38:27] [1] this is going to take the YouTube video and just extract out the audio because you only need the audio to run the transcription.
[00:38:39] [1] So I'm going to copy-paste some things.
[00:38:50] [1] And then after that, this is the Whisper command, which runs the transcription.
[00:38:56] [1] This will take a while. So after I run that, I'm going to show how to create the whole thing from the playlist.
[00:39:06] [1] Okay, let's let that go for a while. And I don't think I shared this in the chat yet.
[00:39:20] [1] So here's a question. When you have show notes for your streams or your podcasts, what information usually goes in there?
[00:39:32] [2] I would say.
[00:39:33] [1] Like summary chapters, things like that.
[00:39:35] [2] Yeah, summary any links that are mentioned during the show. And
[00:39:43] [2] because that's another thing. Oh, that actually, that's a great callout. I was using a tool for Twitch chat downloader,
[00:39:56] [2] which I just pasted as well. And
[00:40:02] [2] because that would take all the links and then I would put it in there as well.
[00:40:09] [2] I don't know what else do I put in them. It's been a hot minute.
[00:40:18] [1] Okay, I just have to do a couple of things real quick because for this Whisper command to run, you need to clone the repo down, download the whole giant model, which is like three gigabytes, and that all takes a while.
[00:40:30] [1] So I just plopped this into my folder for where I have this living on my computer, which I just use when I need something on the fly.
[00:40:41] [1] So if we look here, we're going to see it start transcribing real quick. So there's that going.
[00:40:50] [1] If you have like music or something at the beginning or just silence, sometimes it doesn't know what to do.
[00:40:55] [1] So it just plops that in.
[00:40:58] [2] Yes, you have.
[00:40:59] [1] Yeah, because you have thought, it could be anything. It just, it hallucinates.
[00:41:03] [1] So it needs to just like needs to put some word in because it can't, or if it knows it's music, it'll put audio or something like that.
[00:41:11] [1] But if it can't figure that out, it'll just kind of throw some random, some random word in.
[00:41:16] [1] Like sometimes at the end of the video, there's silence, it'll just repeat the last line like six times in a row or something.
[00:41:22] [2] Okay. Okay. That's fine.
[00:41:25] [1] Yeah, so this won't put out. Oh, it looks like you hopped in before.
[00:41:30] [2] It looks like before I go live.
[00:41:34] [2] Before I.
[00:41:37] [1] Okay, that's cool. So I'm going to let that keep going. Now
[00:41:44] [1] , this is still using YT-DLP. Oh, this is going to do instead of downloading the video and turning it into audio or downloading anything at all, we're just going to analyze the metadata of the videos.
[00:42:01] [1] And I need your playlist ID though, which I'm assuming is something that you wouldn't know how to find offhand, but I've got, I know where it is because I was
[00:42:15] [1] using, I already transcribed a couple of your episodes.
[00:42:19] [2] Oh geez.
[00:42:21] [1] Okay, hold on. This is not what I want though.
[00:42:25] [1] I have, I think here.
[00:42:30] [1] Okay, cool. Yeah, so I'm going to just walk through this whole process of how this stuff came about real quick.
[00:42:36] [1] So I'm not really going to show any of this, but I just need the
[00:42:40] [1] playlist ID.
[00:42:44] [1] Let's see.
[00:42:49] [1] There we go. So every channel has a channel ID and every playlist has a playlist ID.
[00:42:58] [1] And once you have that, you can use YT-DLP to do stuff. So let me just drop that there.
[00:43:07] [1] So this is going to create, it says write info dash JSON. That's going to create a bunch of JSON files.
[00:43:13] [1] And then the dash O, this is an output template. So what it's going to do is it's going to take the upload date and add the video ID after.
[00:43:25] [1] And this is just because you want them to have unique names, but you don't just want it to do the default behavior, which is take the title of the video and make up the file because then you have spaces, you have emojis,
[00:43:37] [1] you have all this stuff in there that you don't want in your titles. So this just gives you a nice clean sanitized title that also can then be ordered chronologically because it starts with the upload date.
[00:43:49] [1] So that's pretty useful. So I'm going to take this.
[00:43:55] [2] Learner, Learner just put,
[00:44:00] [2] they think it's not hallucinating, but just fabricating fake stories. In their opinion, it's like deep actual magic.
[00:44:11] [2] Possibly, possibly. We will find out.
[00:44:17] [1] Okay, so.
[00:44:25] [1] So hopefully this works. So you have 112 videos. It says 113 because for some reason the very last one shows a live thing and it says like, you're about to go live, but you're actually not about to go live.
[00:44:40] [2] Oh, okay. Well, that's fun.
[00:44:43] [1] Yeah, let me show you what I'm talking about. So if we go to this link that we just gave it, this is the playlists here.
[00:44:50] [1] And if you go all the way to the bottom, you see this thing, Teach Gen Tech live stream.
[00:44:54] [1] I'm not sure why that's there.
[00:44:57] [2] Oh, that's great.
[00:44:58] [1] It just says live stream off. This may be if just people have live stream before, this is just always on afterwards, but I'm not sure.
[00:45:07] [1] Or maybe someone's been waiting forever. They're just waiting there for you.
[00:45:14] [2] Is that on one of the playlists or?
[00:45:18] [1] So the playlist I'm looking at right now is called Uploads from Gen Gen Nod. So every channel has this by default.
[00:45:24] [1] I don't really know how to find it though, aside from literally just figuring out the channel ID or the playlist ID and then putting it in this URL here.
[00:45:32] [1] The way I originally got the playlist ID was by having to use the YouTube API to basically query for the playlist ID from your channel, which I needed to find the channel ID, which I forget how I even found that in the first
[00:45:48] [1] place. Some people, if they don't have a custom name, it will be their actual URL.
[00:45:53] [1] But if you do have a custom name, it takes that over. So this is all like YouTube under the hood kind of stuff.
[00:45:59] [1] And the great thing about YT-DLP is that it lets you not have to figure all this stuff out.
[00:46:04] [1] You just use a CLI tool that can help you get all this information without having to mess with the API.
[00:46:11] [2] Put in the chat
[00:46:14] [2] that link.
[00:46:17] [1] YT-DLP?
[00:46:19] [2] No, the playlist.
[00:46:21] [1] The playlist. Yeah, yeah, yeah.
[00:46:23] [2] Yeah, because now I'm like.
[00:46:28] [1] Whose channel is this?
[00:46:31] [2] It was on mine. And I forgot how to block people, so it's just going to sit there.
[00:46:35] [1] I might be able to.
[00:46:36] [2] Or like I blocked them, but I was like, I think you are a mod.
[00:46:41] [1] Hold on.
[00:46:41] [2] And I was like, I don't remember how to kick someone and all that. So yeah.
[00:46:48] [1] I think I do mod view. Wait, no.
[00:46:52] [2] Oh.
[00:46:55] [2] Yay, thanks, Ben. Yeah, Ben's a mod too.
[00:46:57] [1] Oh, great. Awesome. Cool.
[00:46:58] [2] I don't remember. I don't.
[00:47:01] [1] It's like we're all mods here.
[00:47:04] [2] I was like, yeah, I was like, I have four mods and I never changed anybody.
[00:47:09] [1] You said you lost them.
[00:47:10] [2] Learner.
[00:47:13] [2] I hope they provide blood pressure monitors in airplanes. Like really? What?
[00:47:19] [1] Have you heard of what's going on with Boeing?
[00:47:22] [2] Oh, yeah.
[00:47:23] [1] I'm not sure if that's what it's in reference to, but I'm not too worried about it.
[00:47:28] [1] It's fine.
[00:47:29] [2] Okay, I'm going in scene since this is my stream. What is this? It doesn't even let me delete it off of my playlist.
[00:47:38] [2] What is this? Like I can't see it anywhere.
[00:47:45] [2] Oh, there's one waiting in this live stream that does not exist.
[00:47:51] [1] Okay, so check this out.
[00:47:53] [2] Okay. Yes. You got me really distracted on the whole, there's a random video. You're welcome.
[00:48:02] [1] Yep. Okay, so this is now what we got from the CLI tool. And this is stuff you could get from the YouTube API.
[00:48:11] [1] It basically just takes each episode and gives you all of the metadata. This file is actually like really, really long because it even includes things like video formats and every single type of thumbnail and all the cap
[00:48:24] [1] tions. So if you close those three, you end up with a slightly more manageable JSON payload.
[00:48:31] [1] And each video has a video ID, much like a playlist ID, much like a channel ID, has a title.
[00:48:37] [1] And then if you just want the most high-res thumbnail, ignore the thumbnails array and just check this one out.
[00:48:43] [1] That one gives you that. Look at that, look at you. And then
[00:48:49] [1] a description
[00:48:51] [1] , which will need to be parsed because you have like line breaks and things like that.
[00:48:56] [1] So trying to decide whether I want to actually pull in your descriptions or not because they're not exactly standard.
[00:49:04] [1] So it might make more sense just to recreate a description from scratch. And then there is the actual URL of the video.
[00:49:16] [1] You got like stuff like analytics, comments, likes, that sort of stuff.
[00:49:22] [1] The upload date is here. So it gives it to you in year, month, date without any separators.
[00:49:31] [1] And then it shows you which playlist it's in. So it's in the uploads from Gen Gen Nod, which is the base playlist.
[00:49:41] [1] And I think that's pretty much all the stuff that we need to worry about. So now that we got that, something I created, now it's time I know how I'm doing more scripting.
[00:49:53] [1] So this is a giant node script. That what it's going to do is it's going to take the JSON files and then it's going to pull out the specific information we want and then create a Markdown file with front matter that pla
[00:50:12] [1] ces all that information in there. So it's going to create a show link for the URL, a slug, which will just be all lowercase with dashes.
[00:50:22] [1] So we need to do this, run this regular expression to basically sanitize it.
[00:50:27] [2] Can you zoom in a little bit?
[00:50:29] [1] Yeah. Yeah, so these are some regexes, regular expressions, which
[00:50:36] [1] I'm sure you haven't written a lot, but do you know what a regular expression is?
[00:50:40] [2] It's been a while. Refresh me.
[00:50:42] [1] It's a way to, it's a really complicated thing to do something that should be really simple where you need to say you want to run through all these files and I want to pull out specifically the date.
[00:50:58] [1] So let's say I want to take the date, which is formatted like 2022 0701, and I wanted to find every single version of that without searching for like a specific date.
[00:51:11] [1] And then I want to manipulate it to add dashes in between. That's what you usually have expression for.
[00:51:18] [1] So you like match uncertain patterns and that pattern is basically whether to include or exclude things.
[00:51:25] [1] So you're including just numbers and it just has to be a certain number of numbers.
[00:51:31] [1] And then once you find it, you like replace it with dashes. So these are the things that ChatGPT is writing these regular expressions for me.
[00:51:39] [1] I know what they do and vaguely what the syntax means, but I couldn't really explain to you exactly how this works right now.
[00:51:46] [1] It's the same that I'm trying to figure out how to get better at, but it's just like it's a very, very obscure syntax that also is slightly different depending on how you're doing regular expressions.
[00:51:59] [1] So yeah, anyway.
[00:52:02] [1] Wait, this is, sorry. So this is for sanitizing the title. This is for
[00:52:06] [1] finding the
[00:52:09] [1] dates because it's looking for numbers and four, two, two, and then yeah. So that's not too important, but this is where it's going to include the URL, the title after it's run through the sanitizer, the actual title wit
[00:52:27] [1] hout anything removed or altered, the published date, which includes dashes in between because I think it makes it easier to read that way, the playlist on, and then the cover image, which is the thumbnail.
[00:52:42] [1] So I think that is all we need to do there. So this is going to be
[00:52:51] [1] show notes. And then you just need to have your
[00:52:58] [1] NPM shit up. Sorry, NPM and NIT.
[00:53:05] [2] Really quick. Chris, hi again. And your wifey was here earlier and I told her that she needs to be friends with Anthony's wifey because they would just be really cool friends and it would be really dope and they should be
[00:53:19] [2] friends.
[00:53:22] [2] But yes, we are taking a look at all of this and looking at if we were to keep up all of the random
[00:53:32] [2] Teach Gen Techs in the future. Because I do miss live streaming. It was fun, but it's a lot to like have to redo all of this.
[00:53:44] [1] That's why ideally you redo it in a way where it also puts in processes so that things are much simpler as you go.
[00:53:52] [1] So this is the process that allows you to do it with a bulk of videos, but it's also something that you could just do on a single video.
[00:53:59] [1] So after you do a video, you can even have like a cron thing set up on some service that would basically detect every time you post a new YouTube video and it could run this whole workflow for you.
[00:54:09] [1] It could generate this Markdown for you. It could run the transcription on it. It could feed that to NLLM, which would give you back the show notes.
[00:54:16] [1] You could just get all of that together at once and you could even automate the fact where you wouldn't have to start it in the first place.
[00:54:23] [1] It would just watch for new. So that's the dream and that's pretty getting close to it.
[00:54:28] [2] Yeah.
[00:54:30] [1] Okay, so now that that's that, let's see if this still
[00:54:35] [1] has another like half hour to go, I think. So I'm going to just, so people have some context on what's going on, I'm going to show the ones that I already kind of created over here.
[00:54:49] [1] So once the whisper transcription is done, I then run.
[00:54:54] [2] Zoom in a little bit more.
[00:54:56] [1] Yeah.
[00:54:56] [2] More forward. Thank you.
[00:54:58] [1] Yeah, so once the transcription is done, then there's another script that will just run some transformations to make the transcript like more human readable in terms of the timestamps and things like that.
[00:55:12] [1] And then it takes this whole prompt and basically concatenates it onto here. So this is saying you want to create a one sentence
[00:55:22] [1] summary. You can use that in your metadata if you want it for the description of the show.
[00:55:28] [1] And then a one paragraph summary that gives you a little bit more longer description.
[00:55:34] [1] And then create chapters based on the topics discussed throughout, include timestamps, and I kind of give it some rules like don't make them too short, don't make them too long, and then give a description for each chap
[00:55:46] [1] ter. And I find that especially as you have longer and longer episodes, if it goes past like 45 minutes, and especially if it goes past like an hour and a half, it will get confused and not be able to generate chapters all
[00:55:57] [1] the way to the end. It'll generate chapters like the first half, and then it'll just say the last one is like what happens at the end of the episode.
[00:56:05] [1] So the way you can get around that, this one's, let's see, this one's, this is only an hour.
[00:56:11] [1] This should be good. So what I do, this is what I probably still have to automate after having detected this and inserted here.
[00:56:17] [1] But if you tell it where the very last timestamp is, it knows, okay, the chapters need to go till here at least.
[00:56:24] [2] Okay, okay.
[00:56:25] [1] And then you give it an example. You say, then format it as a Markdown file with the first sentence and then the second, I just have to say TL;DR, you can take that out.
[00:56:36] [1] And then the chapters with the starting timestamp, the name of the chapter, and the description.
[00:56:43] [1] So we'll just generate a single one so people can see. And I'm actually using Claude now instead of ChatGPT because Claude 3 is the current kind of state of the art.
[00:56:53] [1] There will probably be a GPT-5 coming out sometime soon that will be better than Claude 3, but as of now, this gives kind of the best outputs I find.
[00:57:03] [2] Yeah.
[00:57:07] [1] And this is the transcription didn't transcribe your name correctly. So if the transcription has errors in it, your show notes will have errors in it as well.
[00:57:15] [1] That's pretty rare though. So for the most part, it's usually fine. So Anthony teaches Jen how to deploy a React application using V, oh my God, I picked this one, and Vercel deployment platform.
[00:57:28] [1] So this was our first episode. And I'm going to wait till it's done and then copy paste it out so we can see it a little better.
[00:57:38] [1] And then the last thing that's still kind of manual because I'm not using an API to hit Claude or ChatGPT is I just copy paste it and then put it here right on top of the transcript.
[00:57:51] [1] And then let's save that and then do this.
[00:58:05] [1] There we go. So I teach Jen how to deploy a React application using the V build tool and Vercel deployment platform.
[00:58:12] [1] So that is exactly what happened. This is how I walk through the process.
[00:58:16] [2] Can you please just like control find my name, please?
[00:58:20] [1] Yeah.
[00:58:21] [2] And replace it.
[00:58:22] [1] Yeah, yeah, yeah.
[00:58:33] [1] Just make sure.
[00:58:41] [2] Thank you.
[00:58:42] [1] Yeah, yeah. I think that, yeah, and then teach Jen tech.
[00:58:54] [1] My partner's Jen is not this Jen.
[00:58:58] [2] Yeah.
[00:58:58] [1] This is a different Jen.
[00:59:00] [2] It is a different Jen.
[00:59:01] [1] That's funny.
[00:59:04] [2] That's supposed to be my name.
[00:59:06] [1] W
[00:59:08] [1] ell, it knew that if Jen is with a G, then Genot would be with a G also at least.
[00:59:13] [2] You know, it's close. We got it. That at least gets me some of them.
[00:59:21] [2] Thank you. Thank you.
[00:59:22] [1] There's other things you can do. I think when you run the transcription, you can actually give a prompt beforehand that can be like this, here, like these names and these people.
[00:59:30] [1] So it kind of knows, right?
[00:59:31] [2] Yeah. I had to do that with ChatGPT too. Okay, thank you. I appreciate it.
[00:59:36] [1] Cool. Along the way, they discuss various web development concepts and tools like JavaScript frameworks, build tools, version control, and deployment.
[00:59:43] [1] Jen asks beginner-friendly questions to gain a foundational understanding of the workflow.
[00:59:48] [1] Cool.
[00:59:48] [2] Oh, look at that.
[00:59:52] [1] It doesn't say Jen is a beginner and asks questions because she doesn't know what's happening.
[00:59:58] [2] Beginner-friendly. Yay.
[01:00:00] [1] That's great. Claude is nice. Claude has a bit more social IQ than ChatGPT. And then we got the introduction.
[01:00:09] [2] That's funny.
[01:00:11] [1] Discussion of Jen's background and journey into tech, explanation of terminal and generating the React project, modifying the React code and running the app locally, committing the project to GitHub, deploying the React
[01:00:22] [1] app to Vercel, discussing the difference between websites and web apps, wrapping up a homework assignment.
[01:00:27] [1] I gave you a homework assignment. I wonder if you did it.
[01:00:31] [2] I don't know.
[01:00:32] [1] I think it was, oh, it was.
[01:00:35] [2] That was almost two years ago.
[01:00:37] [1] Yeah, it was something to do with the CSS on the site. She didn't do any CSS.
[01:00:41] [2] Oh, yeah, because I was just barely learning that. That's crazy.
[01:00:46] [1] There may be some CSS wiring you have to do right now to set up or you have it in Next.
[01:00:49] [1] js
[01:00:52] [1] ?
[01:00:54] [2] Okay, and then it created the Markdown file already, right?
[01:00:59] [1] So this is why I say this is currently, there's two pieces to this workflow that are not connected to each other yet.
[01:01:06] [1] So this was the Markdown file over here that was created. And so I need to combine these two things.
[01:01:13] [1] So this ends up in this file here. And then we'll be pretty dang, dang close. Then you also need to have like headers as well.
[01:01:24] [1] That's just a couple of things I need to put when I'm generating the script. So yeah, and then this is not like an Astro site right now.
[01:01:32] [1] This is just a bunch of Markdown files. But if we were to plop these into your Astro wind, actually, do you have five more minutes or do you need to go?
[01:01:40] [2] I need to go soon, but I have like five more minutes.
[01:01:42] [1] Okay, let's just do this really quick then. So this is going to be Jen Genod, TJT.
[01:01:51] [1] Okay, that's going to be.
[01:01:52] [2] Dude, you could do it in code spaces if you wanted to.
[01:01:57] [1] Yeah, I could. I would rather just have this on my computer because I'm probably going to work on this.
[01:02:04] [2] Yeah, I figured. I was like, yeah, I see that happening. You're like, this is a fun project.
[01:02:10] [2] Yay.
[01:02:13] [1] Let's see. Oh, no. It goes in content, obviously. Content collections. Hey, yo.
[01:02:23] [1] Let's see.
[01:02:28] [1] Too many folders. I'm pretty sure it's this one.
[01:02:35] [1] Did I not save it?
[01:02:42] [1] Okay, whatever.
[01:02:49] [1] Okay, it might be an issue in terms of how the front matter is structured, but if so, it'll give us some errors because they've got Zod running on the content collection
[01:03:02] [1] .
[01:03:04] [1] Okay. Yep, so date needs to be a string. Wait, what is a string? Oh, it needs to be typed date.
[01:03:12] [1] I see. So you got to do one of these guys.
[01:03:18] [1] Might have been it.
[01:03:26] [1] Cool. So it doesn't pull in the cover because that's just not how they have their stuff set up.
[01:03:32] [1] But you've got, let me put in some
[01:03:36] [1] Markdown real quick for some headers. So.
[01:03:48] [1] Chapters.
[01:03:54] [1] Cool. So yeah, this already looks pretty nice, right?
[01:04:00] [2] Yes.
[01:04:03] [1] One thing actually is that these need to be line breaks.
[01:04:11] [2] And I added you as a contributor, so if you get stuff, you don't have to wait for me to approve repos becaus
[01:04:20] [2] e.
[01:04:20] [1] Yeah.
[01:04:20] [2] Can I learn a?
[01:04:22] [1] Good idea. Cool. Awesome. So yeah, great. We got pretty far actually. We already have a website with Markdown files for every one of your shows with front matter.
[01:04:33] [1] And now we just got to run the thing on the thing. So I'll probably just set up.
[01:04:38] [2] A little bit of ants.
[01:04:39] [1] So I'll just like run through all of your episodes kind of in one go while I'm asleep.
[01:04:43] [1] And then we'll just kind of work from there.
[01:04:47] [2] Good luck. Good luck. It's a lot. It is a lot.
[01:04:51] [1] You just set up a command and hit go and it just does. It may take two nights, but we'll get there.
[01:04:57] [2] Yeah, it is. It's pretty cool. It's pretty cool. And I appreciate that we are back in doing this.
[01:05:04] [1] That's all fine. You don't need to contribute.
[01:05:07] [2] Yeah, no. I thought this was a good topic though, because it is about
[01:05:12] [2] .
[01:05:12] [1] I thought it was called AutoGen Show Notes. So I'm not sure what they would have thought it was going to be.
[01:05:17] [2] No, because auto generating show notes and generating show notes in general is really difficult for me.
[01:05:24] [2] And like that's why I was saying like if Jen was listening to it, she, like I feel like Jen would understand making show notes a lot better as well because of knowing how to summarize it better.
[01:05:38] [2] I'm not great at that. And as to why I'm excited about this, but it is, we went through more of the technical side of it.
[01:05:45] [1] So Jen uses this tool that I built for her work sometimes. When she has video, she's like, can I use your transcription thing?
[01:05:52] [1] And I'll create a transcription and I'll generate chapters and I'll even have it give like key takeaways and like improvements they can make and then have that all in one big thing and then give it to her and then she'll
[01:06:02] [1] use that in her writing.
[01:06:04] [2] So that means if we need to get to the point where we can explain it to somebody, if you can explain it to Jen, I feel like we can make it consumable for people not in the tech area like Sarah as well, because her husband
[01:06:19] [2] , Chris, that said, hi, was, I knew him from Denver Startup Week and stuff. So, and he's been on the show too.
[01:06:27] [1] Yeah. Yeah, the biggest issue is you need to use the CLI to actually create the transcriptions right now.
[01:06:32] [1] So the next step would be creating a website where people could just input things and then it'll do it all.
[01:06:39] [1] But then I need to like charge for it at a certain point. Because that would require actually using APIs that cost money to transcribe and to do the show note generation.
[01:06:48] [1] Because if it's only free, I can do this on my computer.
[01:06:52] [2] Yeah, but if you took the CLI out of it, I feel like people would, there would be, it would make it a lot more accessible to other people that feel like they would want to use this for their content.
[01:07:02] [1] Yeah, ideally it'll be an input box where you'll copy paste the URL in and then you'll just click a button and then wait a while and then it will just print it all out on the screen for you.
[01:07:11] [1] That's the goal.
[01:07:13] [2] That's fair. Okay, so I'm looking,
[01:07:19] [2] I'm going to, since we are wrapping up, I'm going to hit raid over to Nikki T.
[01:07:26] [1] Nikki T.
[01:07:28] [2] Yeah, I like that it was supposed to be Nick YouTube and it came to Nikki T. So we're going to raid over there.
[01:07:35] [2] And thank you everyone for joining today. I appreciate it. It was fun.
[01:07:39] [1] When do you want to do this again?
[01:07:41] [2] I don't know.
[01:07:44] [2] Probably next week.
[01:07:45] [1] You want to do the same time next week?
[01:07:48] [2] Possibly.
[01:07:50] [1] Let's tentatively schedule for that. And if we need to move it, we can hold it lightly.
[01:07:54] [1] But yeah, I'll be down to do this every week for a while.
[01:07:57] [2] That'd be dope. Awesome. Thank you. Bye.
[01:08:02] [1] Bye.