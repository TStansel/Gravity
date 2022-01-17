event = { "Records": [{"body": "this is a body"}]}

if ("body" not in event["Records"][0]):
  print("hi")
else:
  print("paren woked")