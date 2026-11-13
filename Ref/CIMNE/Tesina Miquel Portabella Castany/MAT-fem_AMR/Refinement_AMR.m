function [ERP,NES] = Refinement_AMR(moc,EError,GlobalError,maxerr,...
                                    GlobalU,EVol,ElemDim)

%% Refinement Evaluates the element refinement parameters and computes the
%             new element sizes
%
%  Parameters:
%
%    Input, moc : Mesh optimality criteria
%                  1. Equal distribution of the global error
%                  2. Equal distribution of the specific error
%        EError : Element estimated error vector
%   GlobalError : Global estimated error
%        maxerr : Permissible error
%       GlobalU : Global strain energy
%          EVol : Element volume vector
%       ElemDim : Element size vector
%   
%    Output, ERP the element refinement parameter vector
%            NES the new element size vector

  global elements;

  nelem  = size(elements,1);           % Number of elements
  nnode  = size(elements,2);           % Number of nodes per element

  ERP = [];
  NES = [];
  m = 1;                % Degree of the basis polynomial functions
  d = 2;                % Number of dimensions of the problem
  q = (2*m+d)/2;        % Convergence rate for the local refinement
                        % parameter based on the EDGE
                        
  TotalVolume = sum(EVol);
  
  for i = 1 : nelem
  
% Equal distribution of the global error
    if (moc == 1)
      ERP = [ERP;(EError(i)*sqrt(nelem)/GlobalError)^(1/q)*...
                 (GlobalError/(maxerr*GlobalU))^(1/m)];
    
% Equal distribution of the specific error
    elseif (moc == 2)
      ERP = [ERP;((EError(i)/(maxerr*GlobalU))*...
                  sqrt(TotalVolume/EVol(i)))^(1/m)];
    end
    NES = [NES;ElemDim(i)/ERP(i)];
    
  end
  
