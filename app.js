//------------------Database Initialization------------------------------
const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "twitterClone.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(`Server Running at http://localhost:3000`);
    });
  } catch (e) {
    console.log(`DB error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBServer();

//-----------------Password Validation------------------------
// const validPassword = (password) => {
//   return password.length < 6;
// };

//----------------like Object----------------------------------
const convertLikedUserObject = (DBObject) => {
  return {
    likes: DBObject,
  };
};

//----------------reply Object-----------------------------------
const convertUserReplayObject = (DBObject) => {
  return {
    replies: DBObject,
  };
};

//-------API-1--------------------------------------------------------
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  //-------Scenario-1------If the username already exists----------
  const newUserReg = `
    SELECT * FROM user
    WHERE username = '${username}';
    `;

  const newUser = await db.get(newUserReg);

  if (newUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    //----Scenario-2----If register password less than 6 character---
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      //--------Password Encryption---------------------------------
      const hashPassword = await bcrypt.hash(password, 10);

      //----Scenario-3----Successful registration of the register---
      const insertUserData = `
            INSERT INTO user(username, password, name, gender)
            VALUES('${username}','${hashPassword}','${name}','${gender}');
            `;

      await db.run(insertUserData);

      response.status(200);
      response.send("User created successfully");
    }
  }
});

//-------API-2--------------------------------------------------------
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  //---Scenario-1----If the user doesn't have a Twitter account-----
  const findUser = `
    SELECT * FROM user
    WHERE username = '${username}';
    `;

  const sameUser = await db.get(findUser);

  if (sameUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    //---Scenario-2---If the user provides an incorrect password-----
    const pwdMatched = await bcrypt.compare(password, sameUser.password);
    if (pwdMatched !== true) {
      response.status(400);
      response.send("Invalid password");
    } else {
      //---Scenario-3---Successful login user return [JWT Token]------
      const payload = { username: username };

      const jwtToken = jwt.sign(payload, "Secret_Key");

      response.send({ jwtToken });
    }
  }
});

//------------Authentication with JWT Token-[Middleware]--------------
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "Secret_Key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        //console.log(payload);
        request.username = payload.username; //--Attach variable to request object
        next();
      }
    });
  }
};

//-------API-3--------------------------------------------------------
//-----latest tweets of people user follows. Return 4 tweets--------
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  //-----get userId from username-----------
  let { username } = request;

  const getUserId = `
  SELECT user_id FROM user
  WHERE username = '${username}';
  `;

  const getUser = await db.get(getUserId);

  console.log(getUser);

  //-----get followingUserId from follower--------------
  const getFollowerId = `
  SELECT following_user_id FROM follower
  WHERE follower_user_id = '${getUser.user_id}';
  `;

  const getFollower = await db.all(getFollowerId);

  console.log(getFollower);

  //-----get selected followerId array---------------
  const getSelectFollow = getFollower.map((eachFollower) => {
    return eachFollower.following_user_id;
  });

  console.log(getSelectFollow);

  //-----Return 4 tweets at a time---------
  const getTweet = `
  SELECT user.username, tweet.tweet, tweet.date_time FROM user INNER JOIN tweet
  ON user.user_id = tweet.user_id
  WHERE user.user_id IN (${getSelectFollow})
  ORDER BY tweet.date_time DESC
  LIMIT 4;
  `;

  const tweetResult = await db.all(getTweet);

  response.send(tweetResult);
});

//-------API-4--------------------------------------------------------
//------Returns the list of all names of people whom the user follows----
app.get("/user/following/", authenticateToken, async (request, response) => {
  //-----get userId from username-----------
  const { username } = request;

  const getUserId = `
    SELECT user_id FROM user
    WHERE username = '${username}';
    `;

  const getUser = await db.get(getUserId);

  console.log(getUser);

  //----get list of follower userId-----
  const getFollowerId = `
  SELECT following_user_id FROM follower
  WHERE follower_user_id = '${getUser.user_id}';
  `;

  const getFollower = await db.all(getFollowerId);
  console.log(getFollower);

  //-----get each follower userId---------------
  const getEachFollowerId = getFollower.map((eachUserId) => {
    return eachUserId.following_user_id;
  });

  console.log(getEachFollowerId);

  //------get Each Name of Follower--------------
  const getFollowerName = `
  SELECT name FROM user 
  WHERE user_id IN (${getEachFollowerId});
  `;

  const finalName = await db.all(getFollowerName);

  console.log(finalName);
  response.send(finalName);
});

//-----------API-5------------------------------------------
//-----Returns the list of all names of people who follows the user-----
app.get("/user/followers/", authenticateToken, async (request, response) => {
  //---------get user_id from username---------------------
  let { username } = request;

  const getUserId = `
  SELECT user_id FROM user
  WHERE username = '${username}';
  `;

  const getUser = await db.get(getUserId);

  //-------get list of follower by user_id-------------
  const getFollowerUser = `
  SELECT follower_user_id FROM follower
  WHERE following_user_id = '${getUser.user_id}';
  `;

  const getFollower = await db.all(getFollowerUser);

  //-----get list of each follower user_id-------------
  const getFollowerId = getFollower.map((eachUser) => {
    return eachUser.follower_user_id;
  });

  //------get list of each follower name---------------
  const getFollowerName = `
  SELECT name FROM user
  WHERE user_id IN (${getFollowerId});
  `;

  const getName = await db.all(getFollowerName);

  response.send(getName);
});

//-----------API-6------------------------------------------
//------User requests a tweet of the user he is following, return the tweet, likes count, replies count and date-time-------------------
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  let { username } = request;

  const { tweetId } = request.params;
  const getUserIdData = `
  SELECT user_id FROM user
  WHERE username = '${username}';
  `;

  const getUserId = await db.all(getUserIdData);

  console.log(getUserId);

  //-------get user_id who Following---------
  const getFollowingIdData = `
  SELECT following_user_id FROM follower
  WHERE follower_user_id = '${getUserId.user_id}'
  `;

  const getFollowingId = await db.all(getFollowingIdData);

  //------get list of each followingId---------------
  const getAllFollowingId = getFollowingId.map((eachUser) => {
    return eachUser.following_user_id;
  });

  //-------get All Array of tweet,likes,replies,date_time---------
  if (getAllFollowingId.includes(tweetId) !== false) {
    response.status(401);
    response.send(`Invalid Request`);
  } else {
    const likeCountAll = `
      SELECT COUNT(user_id) AS likes FROM like
      WHERE tweet_id = '${tweetId}';
      `;

    const likeCount = await db.get(likeCountAll);

    const replyCountAll = `
      SELECT COUNT(user_id) AS replies FROM reply
      WHERE tweet_id = '${tweetId}';
      `;

    const replyCount = await db.get(replyCountAll);

    const tweetAndDate = `
    SELECT tweet, date_time FROM tweet
    WHERE tweet_id = '${tweetId}';
    `;

    const tweetDate = await db.get(tweetAndDate);

    console.log(likeCount, replyCount, tweetDate);

    response.send({
      tweet: tweetDate.tweet,
      likes: likeCount.likes,
      replies: replyCount.replies,
      dateTime: tweetDate.date_time,
    });
  }
});

//-----------API-7------------------------------------------
//------user requests a tweet of a user he is following, return the list of usernames who liked the tweet----------------------

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    let { username } = request;

    const { tweetId } = request.params;

    const getUserId = `
    SELECT user_id FROM user
    WHERE username = '${username}';
    `;

    const getUser = await db.get(getUserId);

    //------get ids of whom following--------------------
    const getFollowingId = `
    SELECT following_user_id FROM follower
    WHERE follower_user_id = '${getUser.user_id}';
    `;

    const getFollowing = await db.all(getFollowingId);

    //------get each id list----------------------------
    const getFollowingIds = getFollowing.map((eachFollower) => {
      return eachFollower.following_user_id;
    });

    //------get tweet id of whom following-----------------
    const getTweetId = `
    SELECT tweet_id FROM tweet
    WHERE user_id IN (${getFollowingIds});
    `;

    const getTweet = await db.all(getTweetId);

    const getTweetIds = getTweet.map((eachTweets) => {
      return eachTweets.tweet_id;
    });

    //------get all likes user name----------------------
    if (getTweetIds.includes(parseInt(tweetId))) {
      const getLikeUserName = `
        SELECT user.username AS likes FROM user
        INNER JOIN like ON user.user_id = like.user_id
        WHERE like.tweet_id = '${tweetId}';
        `;

      const getLikeName = await db.all(getLikeUserName);

      const getLikeNames = getLikeName.map((eachName) => {
        return eachName.likes;
      });

      response.send(convertLikedUserObject(getLikeNames));
    } else {
      response.status(401);
      response.send(`Invalid Request`);
    }
  }
);

//---------------API-8----------------------------------------------
//----------If the user requests a tweet of a user he is following, return the list of replies.--------------------------------------------
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    let { username } = request;

    const { tweetId } = request.params;

    //------get tweet id by username---------------------------------
    const getUserId = `
    SELECT user_id FROM user
    WHERE username = '${username}';
    `;

    const getUser = await db.get(getUserId);

    //------get id whom user was following------------------------
    const getFollowingId = `
    SELECT following_user_id FROM follower
    WHERE follower_user_id = '${getUser.user_id}';
    `;

    const getFollowing = await db.all(getFollowingId);

    const getFollowingIds = getFollowing.map((eachFollower) => {
      return eachFollower.following_user_id;
    });

    //-------user requests a tweet of a user he is following----
    const getUserTweetID = `
    SELECT tweet_id FROM tweet
    WHERE user_id IN (${getFollowingIds});
    `;

    const getUserTweetIDs = await db.all(getUserTweetID);

    const getTweetId = getUserTweetIDs.map((eachTweet) => {
      return eachTweet.tweet_id;
    });

    //-------get each follower name and replies--------------------
    if (getTweetId.includes(parseInt(tweetId))) {
      const getUserNameReply = `
        SELECT user.name,reply.reply FROM user
        INNER JOIN reply ON user.user_id = reply.user_id
        WHERE reply.tweet_id = '${tweetId}';
        `;

      const getUserNameReplyTweet = await db.all(getUserNameReply);

      response.send(convertUserReplayObject(getUserNameReplyTweet));
    } else {
      response.status(401);
      response.send(`Invalid Request`);
    }
  }
);

//--------------API-9-------------------------------------------------
//---------Returns a list of all tweets of the user--------------------
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserId = `
    SELECT user_id FROM user
    WHERE username = '${username}';
    `;

  const getUser = await db.get(getUserId);

  //----------get tweet by user--------------------------------------
  const getUserTweetId = `
    SELECT tweet_id FROM tweet
    WHERE user_id = '${getUser.user_id}';
    `;

  const getUserTweet = await db.all(getUserTweetId);

  const getAllTweet = getUserTweet.map((eachTweet) => {
    return eachTweet.tweet_id;
  });

  //--------get all user tweet data----------------------------------
  const getTweetData = `
    SELECT tweet.tweet, COUNT(like.like_id) AS likes, COUNT(reply.reply_id) AS replies, tweet.date_time AS dateTime FROM tweet
    INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
    INNER JOIN like ON tweet.tweet_id = like.tweet_id
    WHERE tweet.user_id IN (${getAllTweet});
    `;

  const getTweetResult = await db.all(getTweetData);

  response.send(getTweetResult);
});

//----------API-10-----------------------------------------------------
//----Create a tweet in the tweet table-------------------------------
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;

  const { tweet } = request.body;

  const getUserId = `
  SELECT user_id FROM user
  WHERE username = '${username}';
  `;

  const getUser = await db.get(getUserId);

  const dateString = new Date().toISOString();
  const dateTime = dateString.slice(0, 10) + " " + dateString.slice(11, 19);
  const addNewTweet = `
  INSERT INTO tweet (tweet, user_id, date_time)
  VALUES ('${tweet}', '${getUser.user_id}', '${dateTime}');
  `;

  await db.run(addNewTweet);

  response.send(`Created a Tweet`);
});

//---------------------------Watch all tweets--------------------------
app.get("/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getAllTweets = `
    SELECT * FROM tweet;
    `;

  const getTweet = await db.all(getAllTweets);

  response.send(getTweet);
});

//-------------API-11--------------------------------------------------
//-----user requests to delete a tweet of other users-----------------
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;

    const { tweetId } = request.params;

    const getUserId = `
    SELECT user_id FROM user
    WHERE username = '${username}';
    `;

    const getUser = await db.get(getUserId);

    const getUserTweetId = `
    SELECT tweet_id FROM tweet
    WHERE tweet_id = '${tweetId}';
    `;

    const getTweetId = await db.all(getUserTweetId);

    const getAllUserTweetId = getTweetId.map((eachTweet) => {
      return eachTweet.tweet_id;
    });

    if (getAllUserTweetId.includes(parseInt(tweetId))) {
      const deleteTweetId = `
        DELETE FROM tweet WHERE tweet_id = '${tweetId}';
        `;

      const deleteTweet = await db.run(deleteTweetId);

      response.send(`Tweet Removed`);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//------------export file in app------
module.exports = app;
