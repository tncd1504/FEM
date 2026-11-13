function [bmat_b,bmat_s,bmat_m,len] = B_mat_Rev_Shell_v1_1(cxy,Te)

%% B_Mat Computes the strain-displacement matrix for bending moments,
%        membrane forces and shear forces
%
%  Parameters:
%
%    Input, cxy : Element coordinates
%           Te  : Rotation matrix
%   
%    Output, bmat_b the strain-displacement matrix for bending moments
%            bmat_s the strain-displacement matrix for shear forces
%            bmat_m the strain-displacement matrix for membrane forces
%               len the element length

%==================

  x = cxy(2,1) - cxy(1,1);
  y = cxy(2,2) - cxy(1,2);
  len = sqrt(x^2+y^2);
 
  r = (cxy(1,1) + cxy(2,1)) / 2; 
  N(1) = 0.5 ;   % Shape functions and derivates at the gauss pt. = 0
  N(2) = 0.5 ;

  dxN(1) = -1/len;
  dxN(2) =  1/len;

%==================

      bmat_b1  = [ 0, 0,          -dxN(1)  ;
                   0, 0, -N(1)*Te(1,1)/r  ];
               
      bmat_b2  = [ 0, 0,          -dxN(2)  ;
                   0, 0, -N(2)*Te(1,1)/r  ];
 
      bmat_b = [bmat_b1*Te,bmat_b2*Te];
      
%==================

      bmat_s1  = [ 0, dxN(1), -N(1)];
      
      bmat_s2  = [ 0, dxN(2), -N(2)];

      bmat_s = [bmat_s1*Te,bmat_s2*Te];
      
%==================

      bmat_m1  = [          dxN(1),                0,  0 ;
                   N(1)*Te(1,1)/r , -N(1)*Te(1,2)/r ,  0];
               
      bmat_m2  = [          dxN(2),                0,  0 ;
                   N(2)*Te(1,1)/r , -N(2)*Te(1,2)/r ,  0];
                                               
      bmat_m = [bmat_m1*Te,bmat_m2*Te];

