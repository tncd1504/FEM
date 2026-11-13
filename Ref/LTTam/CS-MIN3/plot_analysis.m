function plot_analysis(type_condition,t,L,freq,modeshape)
global nodes gcoord nnode nx ny method
if t/L == 0.1
    if type_condition == 'SSSS'
        disp('____________________________________________________________')
        disp('Tan so khong thu nguyen cua MITC4')
        disp('Dieu kien bien SSSS')
        f_FEM=freq(1:6)';
        fprintf('f_FEM = [%f  %f  %f  %f  %f  %f] \n\n', f_FEM)
        fprintf('Nghiem chinh xac voi t/L = %f \n\n',t/L)
        f_exact=[4.37	6.74	6.74	8.35	9.22	9.22];
        fprintf('f_exact = [%f  %f  %f  %f  %f  %f] \n\n', f_exact)
        disp('____________________________________________________________')
    elseif type_condition == 'CCCC'
        disp('____________________________________________________________')
        disp('Tan so khong thu nguyen cua MITC4')
        disp('Dieu kien bien CCCC')
        f_FEM=freq(1:6)';
        fprintf('f_FEM = [%f  %f  %f  %f  %f  %f] \n\n', f_FEM)
        fprintf('Nghiem chinh xac voi t/L = %f \n\n',t/L)
        f_exact=[5.7100	7.8800	7.8800	9.3300	10.1300	10.1800];
        fprintf('f_exact = [%f  %f  %f  %f  %f  %f] \n\n', f_exact)
        disp('____________________________________________________________')
    end
end
if t/L == 0.005
    if type_condition == 'SSSS'
        disp('____________________________________________________________')
        disp('Tan so khong thu nguyen cua MITC4')
        disp('Dieu kien bien SSSS')
        f_FEM=freq(1:6)';
        fprintf('f_FEM = [%f  %f  %f  %f  %f  %f] \n\n', f_FEM)
        fprintf('Nghiem chinh xac voi t/L = %f \n\n',t/L)
        f_exact=[4.443	7.025	7.025	8.886	9.935	9.935];
        fprintf('f_exact = [%f  %f  %f  %f  %f  %f] \n\n', f_exact)
        disp('____________________________________________________________')
    elseif type_condition == 'CCCC'
        disp('____________________________________________________________')
        disp('Tan so khong thu nguyen cua MITC4')
        disp('Dieu kien bien CCCC')
        f_FEM=freq(1:6)';
        fprintf('f_FEM = [%f  %f  %f  %f  %f  %f] \n\n', f_FEM)
        fprintf('Nghiem chinh xac voi t/L = %f \n\n',t/L)
        f_exact=[5.9990	8.5680	8.5680	10.4070	11.4720	11.4980];
        fprintf('f_exact = [%f  %f  %f  %f  %f  %f] \n\n', f_exact)
        disp('____________________________________________________________')
    elseif type_condition == 'CCCF'
        disp('____________________________________________________________')
        disp('Tan so khong thu nguyen cua MITC4')
        disp('Dieu kien bien CCCF')
        f_FEM=freq(1:4)';
        fprintf('f_FEM = [%f  %f  %f  %f  %f  %f] \n\n', f_FEM)
        fprintf('Nghiem chinh xac voi t/L = %f \n\n',t/L)
        f_exact=[24.0200 40.0390 63.4930 76.7610];
        fprintf('f_exact = [%f  %f  %f  %f] \n\n', f_exact)
        disp('____________________________________________________________')
    end
end
figure('color',[1 1 1])
plot(1:length(f_exact),f_FEM,'b-o')
hold on
plot(1:length(f_exact),f_exact,'r-<')
legend(method,'Exact')
xlabel(['Mesh',' ',int2str(nx),' ','x',' ',int2str(ny)])
ylabel('Frequency')
% %---------------------- plot vibration mode -----------------------
for i=1:length(f_exact)
    U=modeshape(:,i);
    scale=3.5;
    Z=U(1:3:3*nnode-2)*scale;
    figure('color',[1 1 1])
    trisurf(nodes, gcoord(:,1),gcoord(:,2),Z);
    title(['Mode ',num2str(i),' (\omega =  ',num2str(freq(i)),')'])

    view(37,60) ;
    axis off;
end