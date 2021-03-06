'use strict';

var assert = require('assert'), 
    should = require('should'),
    _ = require('underscore'),
    async = require('async'),
    nodesvm = require('../lib/nodesvm');

var xorProblem = [
  [[0, 0], 0],
  [[0, 1], 1],
  [[1, 0], 1],
  [[1, 1], 0]
];
var xorNormProblem = [
  [[-1, -1], 0],
  [[-1,  1], 1],
  [[ 1, -1], 1],
  [[ 1,  1], 0]
];
describe('Linear kernel', function(){
  var kernel = null;
  beforeEach(function(){
    kernel = new nodesvm.LinearKernel();
  });
  it('should have type set to 0', function(){
    kernel.kernelType.should.equal(0);
  });
});

describe('Polynomial kernel', function(){
  var kernel = null;
  beforeEach(function(){
    kernel = new nodesvm.PolynomialKernel(3, 4, 5);
  });
  it('should have type set to 1', function(){
    kernel.kernelType.should.equal(1);
  });
  it('should have degree set to 3', function(){
    kernel.degree.should.equal(3);
  });
  it('should have gamma set to 4', function(){
    kernel.gamma.should.equal(4);
  });
  it('should have r set to 5', function(){
    kernel.r.should.equal(5);
  });
});

describe('RBF kernel', function(){
  var kernel = null;
  beforeEach(function(){
    kernel = new nodesvm.RadialBasisFunctionKernel(3);
  });
  it('should have type set to 2', function(){
    kernel.kernelType.should.equal(2);
  });
  it('should have gamma set to 3', function(){
    kernel.gamma.should.equal(3);
  });
});

describe('Sigmoid kernel', function(){
  var kernel = null;
  beforeEach(function(){
    kernel = new nodesvm.SigmoidKernel(3, 4);
  });
  it('should have type set to 3', function(){
    kernel.kernelType.should.equal(3);
  });
  it('should have gamma set to 3', function(){
    kernel.gamma.should.equal(3);
  });
  it('should have r set to 4', function(){
    kernel.r.should.equal(4);
  });
});

describe('BaseSVM', function(){
  describe('using NU_SVC with Sigmoid Kernel', function(){
    var svm = null;
    beforeEach(function(){
      svm = new nodesvm.BaseSVM({
        type: nodesvm.SvmTypes.NU_SVC,
        kernel: new nodesvm.SigmoidKernel(2),
        nu: 0.4
      });
    });
    
    it('should have a reference to the NodeSVM obj', function(){
      svm._nodeSvm.should.be.ok;
    });

    it('should use Sigmoid kernel ', function(){
      svm.getKernelType().should.eql('SIGMOID');
    });

    it('should use NU_SVC classificator ', function(){
      svm.getSvmType().should.eql('NU_SVC');
    });

    it('should not be trained yet', function(){
      svm.isTrained().should.be.false;
    });
  });

  describe('using EPSILON_SVR with Linear Kernel', function(){
    var svm = null;
    var problem = null;
    beforeEach(function(){
      svm = new nodesvm.BaseSVM({
        type: nodesvm.SvmTypes.EPSILON_SVR,
        kernel: new nodesvm.LinearKernel(),
        C: 1,
        epsilon: 0.1 // epsilon in loss function of epsilon-SVR
      });
      problem = xorNormProblem;
    });
    
    it('should have a reference to the Node SVM obj', function(){
      svm._nodeSvm.should.be.ok;
    });

    it('should use Sigmoid kernel ', function(){
      svm.getKernelType().should.eql('LINEAR');
    });

    it('should use EPSILON_SVR predictor', function(){
      svm.getSvmType().should.eql('EPSILON_SVR');
    });

    it('should not be trained yet', function(){
      svm.isTrained().should.be.false;
    });

    describe('once trained', function(){
      beforeEach(function(done){
        svm.trainAsync(problem, function() {
          done();
        });
      });

      it('should be trained', function(){
        svm.isTrained().should.be.true;
      });

      it('can evaluate itself', function(done){
        svm.evaluate(problem, function (report) {
          report.mse.should.equal(0.25);
          done();
        });     
      });
      it('can perform n-fold cross validation', function(done){
        var dataset = [];
        _.range(50).forEach(function(i){
          xorProblem.forEach(function (ex) {
            dataset.push(ex);
          });
        });
        svm.performNFoldCrossValidation(dataset, 4, function (report) {
          report.mse.should.be.within(0, 2);
          done();
        });     
      });
    });
  });

  describe('using C_SVC on XOR normalized problem with RBF Kernel', function(){
    var svm = null, problem = null;
    beforeEach(function(){
      svm = new nodesvm.BaseSVM({
        type: nodesvm.SvmTypes.C_SVC,
        kernel: new nodesvm.RadialBasisFunctionKernel(0.5),
        C: 1,
        probability: true
      });
      problem = xorNormProblem;
    });

    it('should train with no error', function(){
      var testFunc = function(){
        svm.train(problem);
      };
      testFunc.should.not.throw();      
    });

    it('should train async with no error', function(done){
      svm.trainAsync(problem, function (err) {
        if(!err){
          done();
        }
      });     
    });

    it('can perform n-fold cross validation', function(done){
      var dataset = [];
      _.range(50).forEach(function(i){
        xorProblem.forEach(function (ex) {
          dataset.push(ex);
        });
      });
      svm.performNFoldCrossValidation(dataset, 4, function (report) {
        report.accuracy.should.equal(1);
        done();
      });     
    });
    
    describe('once trained', function(){
      beforeEach(function(){
        svm.train(problem);
      });

      it('can evaluate itself', function(done){
        svm.evaluate(problem, function (report) {
          report.accuracy.should.equal(1);
          done();
        });     
      });

      it('should be trained', function(){
        svm.isTrained().should.be.true;
      });

      it('should be able to return class labels', function(){
        svm.labels.should.eql([0, 1]);
      });

      it('should perform very well on the training set (100% accuracy)', function(){
        problem.forEach(function(ex){
          var prediction = svm.predict(ex[0]);
          prediction.should.equal(ex[1]);  //  means that y E {0;1}
        });
      });

      it('should be able to predict Async', function(done){
        async.each(problem, function(ex, callback) {
          svm.predictAsync(ex[0], function(prediction){
            prediction.should.equal(ex[1]);
            callback();
          });
        }, function(err){ done(); });
      });

      it('should be able to predict probabilities', function(){
        problem.forEach(function(ex){
          var probs = svm.predictProbabilities(ex[0]);
          var sum = 0;
          svm.labels.forEach(function (classLabel) {
            sum += probs[classLabel];
          });
          sum.should.be.approximately(1, 1e-5);
        });
      });

      it('should be able to predict probabilities async', function(done){
        async.each(problem, function(ex, cb){
          svm.predictProbabilitiesAsync(ex[0], function(probabilities){
            var sum = 0;
            svm.labels.forEach(function (classLabel) {
              sum += probabilities[classLabel];
            });
            sum.should.be.approximately(1, 1e-5);
            cb();
          });
        }, function(err){ done(); });
      });
    });
  });
});
