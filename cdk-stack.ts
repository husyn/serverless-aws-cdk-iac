import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';
import * as ecs from '@aws-cdk/aws-ecs';
import * as alb from '@aws-cdk/aws-elasticloadbalancingv2';

const config = require('config');

import { Protocol } from '@aws-cdk/aws-ec2';
import { LoadBalancingProtocol } from '@aws-cdk/aws-elasticloadbalancing';
import { Aws, Duration } from '@aws-cdk/core';

export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //validitity tests
    if (config.ENVIRONMENT != environments.DEV 
      && config.ENVIRONMENT != environments.STG 
      && config.ENVIRONMENT != environments.PRD) {
        throw new Error("Invalid environment in config");
      }

    //networking
    const publicSubnets = [
      {
        subnetType: ec2.SubnetType.PUBLIC,
        name: 'public1',
        cidrMask:config.SUBNET_CIDR_MASK,      
      },
      {
        subnetType: ec2.SubnetType.PUBLIC,
        name: 'public2',
        cidrMask:config.SUBNET_CIDR_MASK,      
      },
      {
        subnetType: ec2.SubnetType.PUBLIC,
        name: 'public3',
        cidrMask:config.SUBNET_CIDR_MASK,      
      }
    ]
    
    const privateSubnets = [
      {
        subnetType: ec2.SubnetType.ISOLATED,
        name: 'private1',
        cidrMask:config.SUBNET_CIDR_MASK,      
      },
      {
        subnetType: ec2.SubnetType.ISOLATED,
        name: 'private2',
        cidrMask:config.SUBNET_CIDR_MASK,      
      },
      {
        subnetType: ec2.SubnetType.ISOLATED,
        name: 'private3',
        cidrMask:config.SUBNET_CIDR_MASK,      
      }
    ]

    const vpc = new ec2.Vpc(this, this.get_logical_prodenv_name('vpc'), {
      cidr: [config.VPC_IP, config.VPC_CIDR_MASK].join("/"),
      maxAzs:3,
      natGateways:0,
      subnetConfiguration: [...publicSubnets, ...privateSubnets]
    });

    //LB
    const applb = new alb.ApplicationLoadBalancer(this, 'LB', {
      vpc: vpc,
      internetFacing: true,
      loadBalancerName: this.get_logical_env_name('lb')
    });

    const listener = applb.addListener('Listener', {
      port: 8080,
      protocol: alb.ApplicationProtocol.HTTP
    });

    let deregistration_delay = 10;
    if (config.ENVIRONMENT == environments.PRD) {
      deregistration_delay = 300;
    }

    const target_group = new alb.ApplicationTargetGroup(this, this.get_logical_prodenv_name('targetgroup'), {
      // deregistrationDelay: deregistration_delay,
      port: 8080,
      protocol: alb.ApplicationProtocol.HTTP,
      targetGroupName: this.get_logical_prodenv_name('targetgroup'),
      vpc: vpc,
      targetType: alb.TargetType.IP
      
    });
  
    //ECS Cluster
    const ecr_repo = new ecr.Repository(this, config.PROJECT_NAME);
      repositoryName: this.get_logical_env_name('repo'),
        lifecycleRules: [
          {
            maxImageCount: 10,
            tagStatus: ecr.TagStatus.ANY,
            description: 'lifecycle cleanup rule'
          }
        ]
    });

    const cluster = new ecs.Cluster(this, this.get_logical_env_name('cluster'), {
      vpc: vpc,
      clusterName: this.get_logical_env_name('cluster')
    });

    const td = new ecs.TaskDefinition(this, this.get_logical_prodenv_name('taskdefinition'), {
      compatibility: ecs.Compatibility.FARGATE,
      cpu: '512',
      memoryMiB: '1024'      
    });
    td.addContainer('container', {
      image: ecr_repo.repositoryUri
    });

    const service = new ecs.FargateService(this, this.get_logical_env_name('service'), {
      cluster: cluster,
      assignPublicIp: false,
      desiredCount: 1,
      taskDefinition: td,
      serviceName: this.get_logical_prodenv_name('service'),
      vpcSubnets: ec2.Vpc.fromVpcAttributes(this, "vpc", vpc)
    });

  }

  get_logical_env_name(resource_type:string):string {
    
    let val = `${config.PROJECT_NAME}-${config.ENVIRONMENT}` 
    if (resource_type) {
      val = val + '-' + resource_type;
    }
    
    return val;
  }
}

enum environments {
  DEV = 'dev',
  STG = 'stg',
  PRD = 'prod'
};
