#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkStack } from './cdk-stack';

const app = new cdk.App();
new CdkStack(app, 'CdkStack', {});
