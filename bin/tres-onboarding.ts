#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { AppStack } from '../lib/app-stack'
import { GatewayStack } from '../lib/gateway-stack'

const env = {
  region: 'eu-west-1'
}

const app = new cdk.App()
// eslint-disable-next-line no-new
const appStack = new AppStack(app, 'OnboardingApp', { env })
new GatewayStack(app, 'OnboardingGateway', appStack.listener, appStack.vpc, { env })
