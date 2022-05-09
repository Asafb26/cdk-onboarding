import * as cdk from 'aws-cdk-lib'
import { Template, Match } from 'aws-cdk-lib/assertions'
import { AppStack } from '../lib/app-stack'

test('DynamoDB Created', () => {
  const app = new cdk.App()
  const stack = new AppStack(app, 'MyTestStack')
  // THEN

  const template = Template.fromStack(stack)

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [
      {
        AttributeName: 'name'
      }
    ]
  })
})
